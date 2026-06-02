import { createHash } from "crypto";
import type { App, TFile } from "obsidian";
import type { SourceFingerprint } from "./types";

export async function fingerprintFile(app: App, file: TFile): Promise<SourceFingerprint> {
  const buffer = await app.vault.readBinary(file);
  const hash = createHash("sha256").update(Buffer.from(buffer)).digest("hex");
  return {
    path: file.path,
    mtime: file.stat.mtime,
    size: file.stat.size,
    hash
  };
}

export function fingerprintKey(fingerprint: SourceFingerprint): string {
  return `${fingerprint.path}:${fingerprint.mtime}:${fingerprint.size}:${fingerprint.hash}`;
}
