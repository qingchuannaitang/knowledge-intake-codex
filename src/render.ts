import { stringifyYaml } from "obsidian";
import type { AiBackendResult, AtomicNoteDraft, IntakeSource } from "./types";

export function renderAtomicNote(source: IntakeSource, result: AiBackendResult): string {
  const now = new Date().toISOString();
  const frontmatter = stringifyYaml({
    source_path: source.file.path,
    source_type: source.sourceType,
    created: now,
    processed_by: "knowledge-intake-codex",
    backend: result.backend,
    status: "atomic-note",
    topics: result.draft.topics,
    aliases: result.draft.aliases,
    links: result.draft.links
  }).trim();

  return [
    "---",
    frontmatter,
    "---",
    "",
    `# ${result.draft.title}`,
    "",
    "## 核心观点",
    renderList(result.draft.summary),
    "",
    "## 关键事实",
    renderList(result.draft.facts),
    "",
    "## 可链接概念",
    renderWikiList(result.draft.concepts),
    "",
    "## 待办/追问",
    renderTaskList(result.draft.tasks),
    "",
    "## 来源摘录",
    renderQuotes(result.draft.quotes),
    "",
    "## 相关笔记",
    renderWikiList(result.draft.related)
  ].join("\n");
}

export function normalizeDraft(draft: Partial<AtomicNoteDraft>, fallbackTitle: string): AtomicNoteDraft {
  return {
    title: stringValue(draft.title, fallbackTitle),
    summary: arrayValue(draft.summary, ["需要进一步整理这份资料的核心观点。"]),
    facts: arrayValue(draft.facts, []),
    concepts: arrayValue(draft.concepts, []),
    tasks: arrayValue(draft.tasks, []),
    quotes: arrayValue(draft.quotes, []),
    related: arrayValue(draft.related, []),
    topics: arrayValue(draft.topics, []),
    aliases: arrayValue(draft.aliases, []),
    links: arrayValue(draft.links, [])
  };
}

function renderList(items: string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- 暂无";
}

function renderTaskList(items: string[]): string {
  return items.length ? items.map((item) => `- [ ] ${item}`).join("\n") : "- [ ] 复核这条自动生成笔记";
}

function renderWikiList(items: string[]): string {
  return items.length ? items.map((item) => `- [[${item}]]`).join("\n") : "- 暂无";
}

function renderQuotes(items: string[]): string {
  return items.length ? items.map((item) => `> ${item}`).join("\n\n") : "> 暂无摘录";
}

function arrayValue(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function stringValue(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return value.trim() || fallback;
}
