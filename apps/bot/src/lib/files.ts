// apps/bot/src/lib/files.ts
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { pipeline } from "stream";
import type { Readable } from "stream";

const streamPipeline = promisify(pipeline);

export function exists(p: string): boolean {
  try { fs.accessSync(p); return true; } catch { return false; }
}

export function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

/** Save upload to disk. */
export async function saveUpload(input: Readable | Buffer, destPath: string) {
  ensureDir(path.dirname(destPath));
  if (Buffer.isBuffer(input)) {
    await fs.promises.writeFile(destPath, input);
    return destPath;
  }
  const ws = fs.createWriteStream(destPath);
  await streamPipeline(input, ws);
  return destPath;
}

/**
 * Build standardized path: /uploads/<telegramId>/<sessionId>/<kind>/<filename>
 */
export function buildUploadPath(
  telegramId: string | number,
  sessionId: string,
  kind: "photo" | "voice" | "document" | "text",
  filename: string
): string {
  const base = path.join(process.cwd(), "uploads", String(telegramId), String(sessionId), kind);
  return path.join(base, filename);
}

/** Delete a folder recursively (safe). */
export function rmDirRecursive(dir: string) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
