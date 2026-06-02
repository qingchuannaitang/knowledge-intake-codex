import { Notice, TFile, normalizePath, type App } from "obsidian";
import { extractFileText } from "./extractors";
import { fingerprintFile, fingerprintKey } from "./hash";
import { generateAtomicNote } from "./ai";
import { classifySource, isProcessableSource, shouldExcludePath, uniqueNotePath } from "./path";
import { renderAtomicNote } from "./render";
import { ensureFolder, IntakeStore } from "./store";
import type { IntakeSource, KnowledgeIntakeSettings, QueueItem } from "./types";

export class IntakePipeline {
  private app: App;
  private settings: KnowledgeIntakeSettings;
  private store: IntakeStore;
  private timers = new Map<string, number>();
  private onChange: () => void;

  constructor(app: App, settings: KnowledgeIntakeSettings, store: IntakeStore, onChange: () => void) {
    this.app = app;
    this.settings = settings;
    this.store = store;
    this.onChange = onChange;
  }

  updateSettings(settings: KnowledgeIntakeSettings): void {
    this.settings = settings;
  }

  enqueue(file: TFile, delayMs = 1200): void {
    if (!this.settings.enabled) return;
    if (!this.shouldConsider(file)) return;

    const existing = this.timers.get(file.path);
    if (existing) window.clearTimeout(existing);
    const timer = window.setTimeout(() => {
      this.timers.delete(file.path);
      void this.process(file);
    }, delayMs);
    this.timers.set(file.path, timer);
  }

  async scanVault(): Promise<void> {
    for (const file of this.app.vault.getFiles()) {
      if (this.shouldConsider(file)) {
        this.enqueue(file, 0);
      }
    }
  }

  async retry(path: string): Promise<void> {
    const file = this.app.vault.getFileByPath(path);
    if (!file) {
      await this.store.update(path, { status: "error", error: "Source file no longer exists." });
      this.onChange();
      return;
    }
    await this.process(file, true);
  }

  async ignore(path: string): Promise<void> {
    await this.store.update(path, { status: "ignored" });
    this.onChange();
  }

  getItems(): QueueItem[] {
    return this.store.all();
  }

  private shouldConsider(file: TFile): boolean {
    return isProcessableSource(file) && !shouldExcludePath(file.path, this.settings);
  }

  private async process(file: TFile, force = false): Promise<void> {
    if (!this.shouldConsider(file)) return;

    const now = new Date().toISOString();
    const sourceType = classifySource(file);
    const fingerprint = await fingerprintFile(this.app, file);
    const existing = this.store.get(file.path);
    if (!force && existing?.status === "completed" && fingerprintKey(existing.fingerprint) === fingerprintKey(fingerprint)) {
      return;
    }

    const queued: QueueItem = {
      path: file.path,
      sourceType,
      fingerprint,
      status: "processing",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      attempts: (existing?.attempts ?? 0) + 1
    };
    await this.store.upsert(queued);
    this.onChange();

    try {
      const extraction = await extractFileText(this.app, file, this.settings);
      if (!extraction.ok) throw new Error(extraction.error ?? "Extraction failed.");

      const source: IntakeSource = { file, sourceType, fingerprint };
      const aiResult = await generateAtomicNote(this.app, {
        sourcePath: file.path,
        sourceType,
        extractedText: extraction.text,
        warnings: extraction.warnings
      }, this.settings);

      await ensureFolder(this.app, this.settings.outputFolder);
      const existingPaths = new Set(this.app.vault.getFiles().map((candidate) => candidate.path));
      const notePath = uniqueNotePath(this.settings.outputFolder, aiResult.draft.title, existingPaths);
      await this.app.vault.create(notePath, renderAtomicNote(source, aiResult));

      await this.store.update(file.path, {
        status: "completed",
        notePath,
        error: undefined
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.store.update(file.path, {
        status: "error",
        error: message
      });
      await this.writeErrorRecord(file.path, message);
      new Notice(`Knowledge intake failed: ${file.name}`);
    } finally {
      this.onChange();
    }
  }

  private async writeErrorRecord(path: string, message: string): Promise<void> {
    await ensureFolder(this.app, this.settings.errorFolder);
    const errorPath = normalizePath(`${this.settings.errorFolder}/${path.replace(/[\\/:*?"<>|#^[\]]+/g, "_")}.md`);
    const content = [
      "---",
      `source_path: ${JSON.stringify(path)}`,
      `created: ${JSON.stringify(new Date().toISOString())}`,
      "status: intake-error",
      "---",
      "",
      "# Intake Error",
      "",
      `Source: [[${path}]]`,
      "",
      "```text",
      message,
      "```"
    ].join("\n");

    const existing = this.app.vault.getFileByPath(errorPath);
    if (existing) {
      await this.app.vault.modify(existing, content);
    } else {
      await this.app.vault.create(errorPath, content);
    }
  }
}
