import { normalizePath, type App } from "obsidian";
import type { IntakeIndex, QueueItem } from "./types";

const INDEX_FILE = "index.json";

export class IntakeStore {
  private app: App;
  private folder: string;
  private index: IntakeIndex = { version: 1, items: {} };

  constructor(app: App, folder: string) {
    this.app = app;
    this.folder = normalizePath(folder);
  }

  async load(): Promise<void> {
    await ensureFolder(this.app, this.folder);
    const path = this.indexPath();
    const file = this.app.vault.getFileByPath(path);
    if (!file) {
      await this.save();
      return;
    }
    try {
      const raw = await this.app.vault.read(file);
      const parsed = JSON.parse(raw) as IntakeIndex;
      this.index = parsed.version === 1 && parsed.items ? parsed : { version: 1, items: {} };
    } catch {
      this.index = { version: 1, items: {} };
      await this.save();
    }
  }

  all(): QueueItem[] {
    return Object.values(this.index.items).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  get(path: string): QueueItem | undefined {
    return this.index.items[path];
  }

  async upsert(item: QueueItem): Promise<void> {
    this.index.items[item.path] = item;
    await this.save();
  }

  async update(path: string, patch: Partial<QueueItem>): Promise<QueueItem | undefined> {
    const existing = this.index.items[path];
    if (!existing) return undefined;
    const next = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    this.index.items[path] = next;
    await this.save();
    return next;
  }

  async save(): Promise<void> {
    await ensureFolder(this.app, this.folder);
    const path = this.indexPath();
    const content = JSON.stringify(this.index, null, 2);
    const file = this.app.vault.getFileByPath(path);
    if (file) {
      await this.app.vault.modify(file, content);
    } else {
      await this.app.vault.create(path, content);
    }
  }

  private indexPath(): string {
    return normalizePath(`${this.folder}/${INDEX_FILE}`);
  }
}

export async function ensureFolder(app: App, folder: string): Promise<void> {
  const normalized = normalizePath(folder);
  if (!normalized || app.vault.getFolderByPath(normalized)) return;

  const parts = normalized.split("/");
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!app.vault.getFolderByPath(current)) {
      await app.vault.createFolder(current);
    }
  }
}
