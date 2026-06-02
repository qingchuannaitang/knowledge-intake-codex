import type { App, TFile } from "obsidian";
import type { ExtractionResult, KnowledgeIntakeSettings, SourceType } from "./types";
import { classifySource } from "./path";

const BINARY_EXTRACTION_NOTE =
  "Binary content was not deeply parsed inside Obsidian. The AI backend receives metadata and the source path for local follow-up.";

export async function extractFileText(
  app: App,
  file: TFile,
  settings: KnowledgeIntakeSettings
): Promise<ExtractionResult> {
  const sourceType = classifySource(file);
  try {
    if (["markdown", "text", "html", "csv"].includes(sourceType)) {
      const raw = await app.vault.read(file);
      return {
        ok: true,
        text: limitText(cleanText(raw, sourceType), settings.maxExtractedChars),
        sourceType,
        warnings: []
      };
    }

    if (["pdf", "docx", "pptx", "xlsx", "image"].includes(sourceType)) {
      return {
        ok: true,
        text: buildBinaryMetadata(file, sourceType),
        sourceType,
        warnings: [BINARY_EXTRACTION_NOTE]
      };
    }

    return {
      ok: false,
      text: "",
      sourceType,
      warnings: [],
      error: `Unsupported file extension: ${file.extension}`
    };
  } catch (error) {
    return {
      ok: false,
      text: "",
      sourceType,
      warnings: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function cleanText(raw: string, sourceType: SourceType): string {
  if (sourceType !== "html") return raw;
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function limitText(text: string, maxChars: number): string {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}\n\n[Truncated to ${maxChars} characters]`;
}

function buildBinaryMetadata(file: TFile, sourceType: SourceType): string {
  return [
    `Source path: ${file.path}`,
    `Source type: ${sourceType}`,
    `File name: ${file.name}`,
    `Extension: ${file.extension}`,
    `Size: ${file.stat.size} bytes`,
    `Modified: ${new Date(file.stat.mtime).toISOString()}`
  ].join("\n");
}
