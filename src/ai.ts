import { requestUrl, type App } from "obsidian";
import { execFile } from "child_process";
import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { AiBackendResult, AiInput, AtomicNoteDraft, KnowledgeIntakeSettings } from "./types";
import { normalizeDraft } from "./render";

export async function generateAtomicNote(
  app: App,
  input: AiInput,
  settings: KnowledgeIntakeSettings
): Promise<AiBackendResult> {
  if (settings.privacyMode === "skip-sensitive" && looksSensitive(input.extractedText)) {
    throw new Error("Skipped by privacy mode because the extracted text may contain sensitive medical or personal data.");
  }

  if (settings.backend === "codex-cli") {
    return { backend: "codex-cli", draft: await runCodex(app, input, settings) };
  }

  if (settings.backend === "openai-api") {
    return { backend: "openai-api", draft: await runOpenAI(input, settings) };
  }

  try {
    return { backend: "codex-cli", draft: await runCodex(app, input, settings) };
  } catch (codexError) {
    if (settings.openaiApiKey && settings.privacyMode === "allow-cloud") {
      return { backend: "openai-api", draft: await runOpenAI(input, settings) };
    }
    throw new Error(`Codex CLI failed and cloud fallback is not enabled: ${messageOf(codexError)}`);
  }
}

async function runCodex(app: App, input: AiInput, settings: KnowledgeIntakeSettings): Promise<AtomicNoteDraft> {
  const tmp = await mkdtemp(join(tmpdir(), "knowledge-intake-codex-"));
  const outputPath = join(tmp, "draft.json");
  try {
    const prompt = buildPrompt(input);
    const cwd = getVaultBasePath(app);
    const args = [
      "exec",
      "--ask-for-approval",
      "never",
      "--sandbox",
      "read-only",
      "--skip-git-repo-check",
      "--output-last-message",
      outputPath
    ];
    if (cwd) args.push("-C", cwd);
    args.push(prompt);

    await execFileWithTimeout(settings.codexCommand || "codex", args, settings.timeoutMs);
    const raw = await readFile(outputPath, "utf8");
    return parseDraft(raw, input.sourcePath);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

async function runOpenAI(input: AiInput, settings: KnowledgeIntakeSettings): Promise<AtomicNoteDraft> {
  if (!settings.openaiApiKey) {
    throw new Error("OpenAI API key is not configured.");
  }

  const response = await requestUrl({
    url: "https://api.openai.com/v1/responses",
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: settings.openaiModel,
      input: buildPrompt(input),
      text: {
        format: {
          type: "json_schema",
          name: "atomic_note_draft",
          strict: true,
          schema: ATOMIC_NOTE_SCHEMA
        }
      }
    }),
    throw: false
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`OpenAI API returned ${response.status}: ${response.text.slice(0, 300)}`);
  }

  const data = response.json as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const text =
    data.output_text ??
    data.output?.flatMap((item) => item.content ?? []).map((content) => content.text ?? "").join("\n") ??
    response.text;
  return parseDraft(text, input.sourcePath);
}

function buildPrompt(input: AiInput): string {
  return [
    "You are an Obsidian knowledge-intake assistant.",
    "Return ONLY valid JSON matching this TypeScript shape:",
    "{ title: string, summary: string[], facts: string[], concepts: string[], tasks: string[], quotes: string[], related: string[], topics: string[], aliases: string[], links: string[] }",
    "Create an atomic note from the source. Keep it concise, useful, and linkable.",
    "Do not modify files. Do not include markdown fences.",
    "",
    `Source path: ${input.sourcePath}`,
    `Source type: ${input.sourceType}`,
    input.warnings.length ? `Warnings: ${input.warnings.join("; ")}` : "Warnings: none",
    "",
    "Extracted content:",
    input.extractedText
  ].join("\n");
}

function parseDraft(raw: string, fallbackTitle: string): AtomicNoteDraft {
  const json = extractJson(raw);
  const parsed = JSON.parse(json) as Partial<AtomicNoteDraft>;
  return normalizeDraft(parsed, fallbackTitle.replace(/\.[^.]+$/, ""));
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI response did not contain a JSON object.");
  return match[0];
}

function execFileWithTimeout(command: string, args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${error.message}\n${stderr || stdout}`.trim()));
        return;
      }
      resolve();
    });
    child.stdin?.end();
  });
}

function getVaultBasePath(app: App): string | null {
  const adapter = app.vault.adapter as unknown as { getBasePath?: () => string };
  return adapter.getBasePath?.() ?? null;
}

function looksSensitive(text: string): boolean {
  return /patient|diagnosis|medical record|身份证|住院号|患者|诊断|病历|手机号|电话/i.test(text);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const ATOMIC_NOTE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "facts", "concepts", "tasks", "quotes", "related", "topics", "aliases", "links"],
  properties: {
    title: { type: "string" },
    summary: { type: "array", items: { type: "string" } },
    facts: { type: "array", items: { type: "string" } },
    concepts: { type: "array", items: { type: "string" } },
    tasks: { type: "array", items: { type: "string" } },
    quotes: { type: "array", items: { type: "string" } },
    related: { type: "array", items: { type: "string" } },
    topics: { type: "array", items: { type: "string" } },
    aliases: { type: "array", items: { type: "string" } },
    links: { type: "array", items: { type: "string" } }
  }
};
