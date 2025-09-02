// apps/bot/src/lib/telegramFiles.ts

/* Telegram file helpers: turn file_id → URL / Buffer / base64
   Works with photos or documents. Great for OCR / marking flows.

   ENV it will look for (first hit wins):
   - TELEGRAM_BOT_TOKEN | BOT_TOKEN | TG_BOT_TOKEN
   Tunables:
   - TELEGRAM_HTTP_TIMEOUT_MS (default 15000)
   - TELEGRAM_MAX_FILE_MB (default 15)
*/

import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const TG_BASE = "https://api.telegram.org";
const TIMEOUT_MS = Math.max(1000, Number(process.env.TELEGRAM_HTTP_TIMEOUT_MS ?? 15_000));
const MAX_MB = Math.max(1, Number(process.env.TELEGRAM_MAX_FILE_MB ?? 15));
const DEFAULT_MAX_BYTES = MAX_MB * 1024 * 1024;

// --- token -------------------------------------------------------------
function getBotToken(): string {
  const token =
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.BOT_TOKEN ||
    process.env.TG_BOT_TOKEN;
  if (!token) {
    throw new Error("❌ Telegram bot token missing (TELEGRAM_BOT_TOKEN | BOT_TOKEN | TG_BOT_TOKEN)");
  }
  return token;
}

// --- tiny fetch helpers ------------------------------------------------
async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal as any });
    return res;
  } finally {
    clearTimeout(t);
  }
}

const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504]);
async function retrying<T>(fn: () => Promise<T>, max = 3, base = 300): Promise<T> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try { return await fn(); }
    catch (e: any) {
      attempt++;
      const status = Number(e?.status ?? e?.response?.status ?? 0);
      const msg = String(e?.message ?? "");
      const aborted = /abort|timed out|timeout/i.test(msg);
      if (attempt > max || (!RETRYABLE.has(status) && !aborted)) throw e;
      const backoff = base * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 150);
      await new Promise(r => setTimeout(r, backoff));
    }
  }
}

// --- LRU-ish cache for getFile ----------------------------------------
const FILE_PATH_CACHE = new Map<string, { path: string; ts: number }>();
const CACHE_LIMIT = 200;
function cacheSet(fileId: string, path: string) {
  if (FILE_PATH_CACHE.size >= CACHE_LIMIT) {
    const oldest = FILE_PATH_CACHE.keys().next().value;
    if (oldest) FILE_PATH_CACHE.delete(oldest);
  }
  FILE_PATH_CACHE.set(fileId, { path, ts: Date.now() });
}
function cacheGet(fileId: string): string | undefined {
  const hit = FILE_PATH_CACHE.get(fileId);
  if (!hit) return;
  // touch
  FILE_PATH_CACHE.delete(fileId);
  FILE_PATH_CACHE.set(fileId, hit);
  return hit.path;
}

// --- core: resolve Telegram CDN link ----------------------------------
export async function getFileLink(fileId: string): Promise<string> {
  const cached = cacheGet(fileId);
  const token = getBotToken();

  if (cached) {
    return `${TG_BASE}/file/bot${token}/${cached}`;
  }

  const url = `${TG_BASE}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`;
  const resp = await retrying(() => fetchWithTimeout(url));

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    const err: any = new Error(`getFile failed: HTTP ${resp.status} ${body}`);
    (err.status = resp.status);
    throw err;
  }

  const json: any = await resp.json();
  const filePath = json?.result?.file_path;
  if (!json?.ok || !filePath) {
    throw new Error(`getFile missing path: ${JSON.stringify(json)}`);
  }

  cacheSet(fileId, filePath);
  return `${TG_BASE}/file/bot${token}/${filePath}`;
}

// --- download helpers --------------------------------------------------
function toDataUrl(buffer: Buffer, mime = "application/octet-stream") {
  const b64 = buffer.toString("base64");
  return `data:${mime};base64,${b64}`;
}

/** Stream-friendly download with max-bytes guard. Falls back to arrayBuffer if no stream. */
export async function downloadBuffer(url: string, maxBytes = DEFAULT_MAX_BYTES) {
  const res = await retrying(() => fetchWithTimeout(url));

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err: any = new Error(`download failed: HTTP ${res.status} ${body}`);
    (err.status = res.status);
    throw err;
  }

  const mime = (res.headers.get("content-type") || "application/octet-stream").split(";")[0].trim();
  const cl = Number(res.headers.get("content-length") || 0);
  if (cl && cl > maxBytes) throw new Error(`file too large: ${cl} > ${maxBytes}`);

  // Try streaming to enforce size; if not available, use arrayBuffer
  const stream = (res as any).body?.getReader ? (res as any).body.getReader() : null;
  if (!stream) {
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    if (buf.byteLength > maxBytes) throw new Error(`file too large (no CL): ${buf.byteLength}`);
    return { buffer: buf, mime };
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  // @ts-ignore - web stream reader type
  let reader = stream as ReadableStreamDefaultReader<Uint8Array>;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      received += value.byteLength;
      if (received > maxBytes) throw new Error(`file too large (stream): ${received} > ${maxBytes}`);
      chunks.push(value);
    }
  }
  const buffer = Buffer.concat(chunks.map((u) => Buffer.from(u)));
  return { buffer, mime };
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
