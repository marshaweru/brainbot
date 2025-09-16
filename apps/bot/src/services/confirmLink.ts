// apps/bot/src/services/confirmLink.ts
import crypto from "node:crypto";

const WEB_API = (process.env.WEB_API_BASE || "").replace(/\/+$/, "");
const SECRET = process.env.SESSION_WEBHOOK_SECRET || "";

export type ConfirmResp = {
  ok: boolean;
  already?: boolean;
  wid?: string;
  plan?: string;
  telegramId?: number;
  error?: string;
};

// base64url → utf8
function b64urlToStr(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  return Buffer.from(b64, "base64").toString("utf8");
}

export async function confirmLinkOnWeb(token: string, telegramId: number): Promise<ConfirmResp> {
  try {
    const t = token.startsWith("st_") ? token.slice(3) : token;

    // If WEB_API is set, call the web endpoint with HMAC
    if (WEB_API) {
      const body = JSON.stringify({ token, telegramId });
      const sig = SECRET ? crypto.createHmac("sha256", SECRET).update(body).digest("hex") : "";
      const res = await fetch(`${WEB_API}/api/link/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(SECRET ? { "x-brainbot-signature": sig } : {}),
        },
        body,
      });

      if (!res.ok) {
        const txt = await res.text();
        return { ok: false, error: `HTTP ${res.status}: ${txt.slice(0, 200)}` };
      }

      // Try parse JSON, fall back to text error
      try {
        const j = (await res.json()) as ConfirmResp;
        return j;
      } catch {
        const txt = await res.text();
        return { ok: false, error: `Bad JSON: ${txt.slice(0, 200)}` };
      }
    }

    // Fallback: decode locally (works even without WEB_API)
    const parsed = JSON.parse(b64urlToStr(t)) as { wid?: string; plan?: string };
    if (!parsed?.wid) return { ok: false, error: "Missing wid" };
    return { ok: true, wid: String(parsed.wid), plan: String(parsed.plan || "free"), telegramId };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Confirm failed" };
  }
}
