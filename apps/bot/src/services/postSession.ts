// apps/bot/src/services/postSession.ts
import crypto from "node:crypto";

// Unified type matching what markingRepo sends
export type SessionResult = {
  wid?: string;
  telegramId: number;
  subject: string;
  paper?: 1 | 2 | 3;
  score: number;                 // normalized 0..100
  outOf?: number;
  grade?: string;
  startedAt?: string;
  finishedAt?: string;
  remarks?: string;
  plan?: string;
  uploads?: Array<{
    kind: "photo" | "voice" | "document" | "text";
    fileId?: string;
    localPath?: string;
    mimeType?: string;
    duration?: number;
    text?: string;
    receivedAt: string;
    late?: boolean;
  }>;
  weakTopics?: Array<string | { topic: string; tip?: string }>;
};

const WEB_API = (process.env.WEB_API_BASE || "").replace(/\/+$/, ""); // e.g. http://localhost:3000
const SECRET = process.env.SESSION_WEBHOOK_SECRET || "";

/** POST the completed session to the web API with optional HMAC auth. */
export async function postSession(result: SessionResult): Promise<{ ok: boolean; error?: string }> {
  if (!WEB_API) return { ok: false, error: "WEB_API_BASE not set" };

  const body = JSON.stringify(result);
  const sig = SECRET ? crypto.createHmac("sha256", SECRET).update(body).digest("hex") : "";

  const res = await fetch(`${WEB_API}/api/session-complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sig ? { "x-brainbot-signature": sig } : {}),
    },
    body,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { ok: false, error: `HTTP ${res.status}: ${txt.slice(0, 200)}` };
  }

  return { ok: true };
}
