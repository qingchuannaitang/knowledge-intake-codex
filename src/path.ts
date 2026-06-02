import { normalizePath, TFile } from "obsidian";
import type { KnowledgeIntakeSettings, SourceType } from "./types";

const TEMP_SUFFIXES = [".tmp", ".temp", ".download", ".crdownload", ".part"];

export function classifySource(file: TFile): SourceType {
  const ext = file.extension.toLowerCase();
  if (ext === "md") return "markdown";
  if (["txt", "log"].includes(ext)) return "text";
  if (["html", "htm"].includes(ext)) return "html";
  if (ext === "csv") return "csv";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "pptx") return "pptx";
  if (ext === "xlsx") return "xlsx";
  if (["png", "jpg", "jpeg", "webp", "gif", "tiff", "bmp"].includes(ext)) return "image";
  return "unknown";
}

export function isProcessableSource(file: TFile): boolean {
  return classifySource(file) !== "unknown";
}

export function shouldExcludePath(path: string, settings: KnowledgeIntakeSettings): boolean {
  const normalized = normalizePath(path);
  if (TEMP_SUFFIXES.some((suffix) => normalized.toLowerCase().endsWith(suffix))) return true;
  return settings.excludeGlobs.some((glob) => globMatches(normalized, glob));
}

export function globMatches(path: string, glob: string): boolean {
  const normalizedGlob = normalizePath(glob.trim());
  if (!normalizedGlob) return false;
  if (normalizedGlob.endsWith("/**")) {
    const prefix = normalizedGlob.slice(0, -3);
    return path === prefix || path.startsWith(`${prefix}/`);
  }
  if (normalizedGlob.includes("*")) {
    const pattern = normalizedGlob
      .split("*")
      .map(escapeRegExp)
      .join(".*");
    return new RegExp(`^${pattern}$`).test(path);
  }
  return path === normalizedGlob || path.startsWith(`${normalizedGlob}/`);
}

export function safeFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|#^[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Untitled";
}

export function uniqueNotePath(outputFolder: string, title: string, existingPaths: Set<string>): string {
  const base = normalizePath(`${outputFolder}/${safeFileName(title)}`);
  let candidate = `${base}.md`;
  let i = 2;
  while (existingPaths.has(candidate)) {
    candidate = `${base} ${i}.md`;
    i += 1;
  }
  return candidate;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
