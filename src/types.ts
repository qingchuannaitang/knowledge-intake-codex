import type { TFile } from "obsidian";

export type BackendMode = "auto" | "codex-cli" | "openai-api";
export type PrivacyMode = "local-first" | "allow-cloud" | "skip-sensitive";
export type SourceType =
  | "markdown"
  | "text"
  | "html"
  | "csv"
  | "pdf"
  | "docx"
  | "pptx"
  | "xlsx"
  | "image"
  | "unknown";

export interface KnowledgeIntakeSettings {
  enabled: boolean;
  backend: BackendMode;
  openaiApiKey: string;
  openaiModel: string;
  codexCommand: string;
  timeoutMs: number;
  outputFolder: string;
  queueFolder: string;
  errorFolder: string;
  excludeGlobs: string[];
  privacyMode: PrivacyMode;
  maxExtractedChars: number;
}

export interface SourceFingerprint {
  path: string;
  mtime: number;
  size: number;
  hash: string;
}

export interface IntakeSource {
  file: TFile;
  sourceType: SourceType;
  fingerprint: SourceFingerprint;
}

export interface ExtractionResult {
  ok: boolean;
  text: string;
  sourceType: SourceType;
  warnings: string[];
  error?: string;
}

export interface AtomicNoteDraft {
  title: string;
  summary: string[];
  facts: string[];
  concepts: string[];
  tasks: string[];
  quotes: string[];
  related: string[];
  topics: string[];
  aliases: string[];
  links: string[];
}

export interface QueueItem {
  path: string;
  sourceType: SourceType;
  fingerprint: SourceFingerprint;
  status: "queued" | "processing" | "completed" | "error" | "ignored";
  createdAt: string;
  updatedAt: string;
  notePath?: string;
  attempts: number;
  error?: string;
}

export interface IntakeIndex {
  version: 1;
  items: Record<string, QueueItem>;
}

export interface AiInput {
  sourcePath: string;
  sourceType: SourceType;
  extractedText: string;
  warnings: string[];
}

export interface AiBackendResult {
  backend: "codex-cli" | "openai-api" | "fallback";
  draft: AtomicNoteDraft;
}
