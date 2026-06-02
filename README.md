# Knowledge Intake Codex

An Obsidian desktop plugin that watches newly added vault files and turns them into atomic notes with Codex CLI or the OpenAI API.

## What it does

- Watches new files in the vault.
- Skips configured generated/internal folders.
- Extracts text from Markdown, TXT, HTML, and CSV.
- Queues PDF, DOCX, PPTX, XLSX, and image files with file metadata so a local AI backend can inspect the source path.
- Creates a new atomic note in `Knowledge/Atomic Notes`.
- Preserves the original source file.
- Maintains an intake queue and an error queue.
- Supports local-first Codex CLI processing and optional OpenAI API fallback.

## Privacy and safety

This plugin is desktop-only. It may call an external local process (`codex exec`) and, if configured, the OpenAI Responses API.

Defaults:

- Backend: `auto`
- Privacy: `local-first`
- Cloud fallback: disabled unless `privacyMode` is set to `allow-cloud` and an API key is configured
- Source files: never deleted, moved, or overwritten
- Generated notes: written only to the configured output folder

Before publishing this as a community plugin, review Obsidian's plugin checklist and disclose the local process and network behavior clearly.

## Development

```bash
npm install
npm run build
```

Copy or symlink the plugin folder into a test vault:

```bash
mkdir -p "/path/to/Test Vault/.obsidian/plugins/knowledge-intake-codex"
cp manifest.json main.js styles.css "/path/to/Test Vault/.obsidian/plugins/knowledge-intake-codex/"
```

Enable it from Obsidian's community plugin settings.

## Commands

- `Knowledge Intake Codex: Scan vault for unprocessed files`
- `Knowledge Intake Codex: Reprocess current file`

## Generated note shape

Generated notes include frontmatter fields:

- `source_path`
- `source_type`
- `created`
- `processed_by`
- `backend`
- `status`
- `topics`
- `aliases`
- `links`

And sections:

- `核心观点`
- `关键事实`
- `可链接概念`
- `待办/追问`
- `来源摘录`
- `相关笔记`
