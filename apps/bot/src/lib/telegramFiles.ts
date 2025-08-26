/* Telegram file helpers: turn file_id → URL / Buffer / base64
   Works with photos or documents. Great for OCR / marking flows.

   ENV it will look for (first hit wins):
   - TELEGRAM_BOT_TOKEN
   - BOT_TOKEN
   - TG_BOT_TOKEN
*/
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

function getBotToken(): string {
  const token =
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.BOT_TOKEN ||
    process.env.TG_BOT_TOKEN;
  if (!token) throw new Error("❌ Telegram bot token missing (TELEGRAM_BOT_TOKEN)");
  return token;
}

/** Resolve Telegram CDN URL for a given file_id */
export async function getFileLink(fileId: string): Promise<string> {
  const token = getBotToken();
  const resp = await fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`
  );
  if (!resp.ok) {
    throw new Error(`getFile failed: HTTP ${resp.status}`);
  }
  const json: any = await resp.json();
  const filePath = json?.result?.file_path;
  if (!json?.ok || !filePath) {
    throw new Error(`getFile missing path: ${JSON.stringify(json)}`);
  }
  return `https://api.telegram.org/file/bot${token}/${filePath}`;
}

/** Download a URL → Buffer, with a max size guard (default 15 MB) */
export async function downloadBuffer(url: string, maxBytes = 15 * 1024 * 1024) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const len = Number(res.headers.get("content-length") || 0);
  if (len && len > maxBytes) {
    throw new Error(`file too large: ${len} > ${maxBytes}`);
  }
  const ab = await res.arrayBuffer();
  const buf = Buffer.from(ab);
  if (buf.byteLength > maxBytes) throw new Error(`file too large (no CL): ${buf.byteLength}`);
  const mime = (res.headers.get("content-type") || "application/octet-stream").split(";")[0].trim();
  return { buffer: buf, mime };
}

/** Convert a Buffer+mime → data URL string */
export function toDataUrl(buffer: Buffer, mime = "application/octet-stream") {
  const b64 = buffer.toString("base64");
  return `data:${mime};base64,${b64}`;
}

/** High-level: file_id → data URL (perfect for vision helpers) */
export async function telegramFileAsDataUrl(fileId: string) {
  const url = await getFileLink(fileId);
  const { buffer, mime } = await downloadBuffer(url);
  return { dataUrl: toDataUrl(buffer, mime), mime };
}

/** High-level: file_id → { base64, mime } (if you prefer explicit base64) */
export async function telegramFileAsBase64(fileId: string) {
  const url = await getFileLink(fileId);
  const { buffer, mime } = await downloadBuffer(url);
  return { base64: buffer.toString("base64"), mime };
}

/** Save Telegram file to a temp path and return { path, mime } */
export async function saveTelegramFileToTmp(fileId: string, extHint?: string) {
  const url = await getFileLink(fileId);
  const { buffer, mime } = await downloadBuffer(url);
  const ext =
    extHint ||
    (mime === "image/jpeg" ? ".jpg" :
     mime === "image/png"  ? ".png" :
     mime === "application/pdf" ? ".pdf" : "");
  const path = join(tmpdir(), `tg-${randomUUID()}${ext}`);
  await fs.writeFile(path, buffer);
  return { path, mime };
}

/** Given a Telegram photo array (lowest→highest quality), pick best file_id */
export function pickBestPhotoId(photos: Array<{ file_id: string; width?: number; height?: number }>) {
  if (!Array.isArray(photos) || photos.length === 0) return null;
  return photos
    .slice()
    .sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))[0].file_id;
}
