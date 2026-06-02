import { Notice, Plugin, TFile } from "obsidian";
import { DEFAULT_SETTINGS, KnowledgeIntakeSettingTab } from "./settings";
import { IntakePipeline } from "./pipeline";
import { IntakeStore } from "./store";
import { INTAKE_ERROR_VIEW, INTAKE_QUEUE_VIEW, IntakeErrorView, IntakeQueueView } from "./views";
import type { KnowledgeIntakeSettings } from "./types";

export default class KnowledgeIntakePlugin extends Plugin {
  settings: KnowledgeIntakeSettings = DEFAULT_SETTINGS;
  store!: IntakeStore;
  pipeline?: IntakePipeline;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.store = new IntakeStore(this.app, this.settings.queueFolder);
    await this.store.load();

    this.pipeline = new IntakePipeline(this.app, this.settings, this.store, () => this.refreshViews());

    this.registerView(INTAKE_QUEUE_VIEW, (leaf) => new IntakeQueueView(leaf, this));
    this.registerView(INTAKE_ERROR_VIEW, (leaf) => new IntakeErrorView(leaf, this));

    this.addRibbonIcon("inbox", "Knowledge Intake Queue", () => {
      void this.activateView(INTAKE_QUEUE_VIEW);
    });
    this.addRibbonIcon("alert-triangle", "Knowledge Intake Errors", () => {
      void this.activateView(INTAKE_ERROR_VIEW);
    });

    this.addCommand({
      id: "scan-unprocessed-files",
      name: "Scan vault for unprocessed files",
      callback: async () => {
        await this.scanVault();
        new Notice("Knowledge intake scan started.");
      }
    });

    this.addCommand({
      id: "reprocess-current-file",
      name: "Reprocess current file",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) void this.pipeline?.retry(file.path);
        return true;
      }
    });

    this.registerEvent(this.app.vault.on("create", (file) => {
      if (file instanceof TFile) this.pipeline?.enqueue(file);
    }));

    this.addSettingTab(new KnowledgeIntakeSettingTab(this.app, this));
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(INTAKE_QUEUE_VIEW);
    this.app.workspace.detachLeavesOfType(INTAKE_ERROR_VIEW);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    if (this.pipeline) this.pipeline.updateSettings(this.settings);
  }

  async scanVault(): Promise<void> {
    await this.pipeline?.scanVault();
  }

  refreshViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(INTAKE_QUEUE_VIEW)) {
      const view = leaf.view;
      if (view instanceof IntakeQueueView) view.render();
    }
    for (const leaf of this.app.workspace.getLeavesOfType(INTAKE_ERROR_VIEW)) {
      const view = leaf.view;
      if (view instanceof IntakeErrorView) view.render();
    }
  }

  private async activateView(type: string): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(type)[0];
    if (existing) {
      this.app.workspace.revealLeaf(existing);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
}
