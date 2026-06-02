import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type KnowledgeIntakePlugin from "./main";
import type { BackendMode, KnowledgeIntakeSettings, PrivacyMode } from "./types";

export const DEFAULT_SETTINGS: KnowledgeIntakeSettings = {
  enabled: true,
  backend: "auto",
  openaiApiKey: "",
  openaiModel: "gpt-4.1-mini",
  codexCommand: "/Applications/Codex.app/Contents/Resources/codex",
  timeoutMs: 60000,
  outputFolder: "Knowledge/Atomic Notes",
  queueFolder: "Knowledge/.intake-queue",
  errorFolder: "Knowledge/.errors",
  excludeGlobs: [
    ".obsidian/**",
    "Knowledge/Atomic Notes/**",
    "Knowledge/.*/**"
  ],
  privacyMode: "local-first",
  maxExtractedChars: 24000
};

export class KnowledgeIntakeSettingTab extends PluginSettingTab {
  plugin: KnowledgeIntakePlugin;

  constructor(app: App, plugin: KnowledgeIntakePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Knowledge Intake Codex" });
    containerEl.createEl("p", {
      text: "This desktop plugin reads files in your vault and may call a local Codex command or the OpenAI API depending on the backend settings."
    });

    new Setting(containerEl)
      .setName("Automatic intake")
      .setDesc("Watch newly created vault files and turn them into atomic notes.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enabled)
          .onChange(async (value) => {
            this.plugin.settings.enabled = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("AI backend")
      .setDesc("Auto tries Codex first and falls back to OpenAI only when an API key is configured.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("auto", "Auto")
          .addOption("codex-cli", "Codex CLI")
          .addOption("openai-api", "OpenAI API")
          .setValue(this.plugin.settings.backend)
          .onChange(async (value) => {
            this.plugin.settings.backend = value as BackendMode;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Codex command")
      .setDesc("Local command used for Codex CLI processing.")
      .addText((text) =>
        text
          .setPlaceholder("codex")
          .setValue(this.plugin.settings.codexCommand)
          .onChange(async (value) => {
            this.plugin.settings.codexCommand = value.trim() || "codex";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("OpenAI API key")
      .setDesc("Only used when OpenAI API is selected or auto fallback is allowed.")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.openaiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.openaiApiKey = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("OpenAI model")
      .setDesc("Model used by the OpenAI API adapter.")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.openaiModel)
          .onChange(async (value) => {
            this.plugin.settings.openaiModel = value.trim() || DEFAULT_SETTINGS.openaiModel;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Privacy mode")
      .setDesc("Local-first avoids cloud fallback unless explicitly enabled by backend/API settings.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("local-first", "Local first")
          .addOption("allow-cloud", "Allow cloud")
          .addOption("skip-sensitive", "Skip sensitive")
          .setValue(this.plugin.settings.privacyMode)
          .onChange(async (value) => {
            this.plugin.settings.privacyMode = value as PrivacyMode;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Output folder")
      .setDesc("Atomic notes will be written here.")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.outputFolder)
          .onChange(async (value) => {
            this.plugin.settings.outputFolder = value.trim() || DEFAULT_SETTINGS.outputFolder;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Queue folder")
      .setDesc("Internal processing state lives here.")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.queueFolder)
          .onChange(async (value) => {
            this.plugin.settings.queueFolder = value.trim() || DEFAULT_SETTINGS.queueFolder;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Error folder")
      .setDesc("Failed intake records are written here.")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.errorFolder)
          .onChange(async (value) => {
            this.plugin.settings.errorFolder = value.trim() || DEFAULT_SETTINGS.errorFolder;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Exclude globs")
      .setDesc("One glob per line. Matching files are never processed.")
      .addTextArea((text) =>
        text
          .setValue(this.plugin.settings.excludeGlobs.join("\n"))
          .onChange(async (value) => {
            this.plugin.settings.excludeGlobs = value
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Scan existing files")
      .setDesc("Queue unprocessed files already present in the vault.")
      .addButton((button) =>
        button.setButtonText("Scan now").onClick(async () => {
          await this.plugin.scanVault();
          new Notice("Knowledge intake scan queued.");
        })
      );
  }
}
