import { ItemView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import type KnowledgeIntakePlugin from "./main";
import type { QueueItem } from "./types";

export const INTAKE_QUEUE_VIEW = "knowledge-intake-queue";
export const INTAKE_ERROR_VIEW = "knowledge-intake-errors";

export class IntakeQueueView extends ItemView {
  plugin: KnowledgeIntakePlugin;

  constructor(leaf: WorkspaceLeaf, plugin: KnowledgeIntakePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return INTAKE_QUEUE_VIEW;
  }

  getDisplayText(): string {
    return "Knowledge Intake";
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  render(): void {
    renderItems(this.containerEl, this.plugin, this.plugin.pipeline?.getItems() ?? [], false);
  }
}

export class IntakeErrorView extends ItemView {
  plugin: KnowledgeIntakePlugin;

  constructor(leaf: WorkspaceLeaf, plugin: KnowledgeIntakePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return INTAKE_ERROR_VIEW;
  }

  getDisplayText(): string {
    return "Intake Errors";
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  render(): void {
    renderItems(this.containerEl, this.plugin, this.plugin.pipeline?.getItems() ?? [], true);
  }
}

function renderItems(containerEl: HTMLElement, plugin: KnowledgeIntakePlugin, items: QueueItem[], errorsOnly: boolean): void {
  containerEl.empty();
  const root = containerEl.createDiv({ cls: "knowledge-intake-view" });
  root.createEl("h3", { text: errorsOnly ? "Error Queue" : "Intake Queue" });

  const visible = errorsOnly ? items.filter((item) => item.status === "error") : items;
  if (!visible.length) {
    root.createEl("p", { text: errorsOnly ? "No failed intake jobs." : "No intake jobs yet." });
    return;
  }

  for (const item of visible) {
    const row = root.createDiv({ cls: "knowledge-intake-row" });
    row.createEl("div", { text: item.path, cls: "knowledge-intake-path" });
    row.createEl("div", { text: `${item.status} · ${item.sourceType} · attempts ${item.attempts}`, cls: "knowledge-intake-meta" });
    if (item.notePath) row.createEl("div", { text: `Note: ${item.notePath}`, cls: "knowledge-intake-meta" });
    if (item.error) row.createEl("pre", { text: item.error, cls: "knowledge-intake-error" });

    const actions = row.createDiv({ cls: "knowledge-intake-actions" });
    actions.createEl("button", { text: "Open" }).addEventListener("click", async () => {
      const file = plugin.app.vault.getFileByPath(item.notePath ?? item.path);
      if (file instanceof TFile) {
        await plugin.app.workspace.getLeaf().openFile(file);
      } else {
        new Notice("File not found.");
      }
    });
    actions.createEl("button", { text: "Retry" }).addEventListener("click", () => {
      void plugin.pipeline?.retry(item.path);
    });
    actions.createEl("button", { text: "Ignore" }).addEventListener("click", () => {
      void plugin.pipeline?.ignore(item.path);
    });
  }
}
