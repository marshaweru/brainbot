// apps/web/app/api/link/confirm/route.ts
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyHS256 } from "@/lib/jwt";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HMAC = process.env.SESSION_WEBHOOK_SECRET || "";
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || "";
const START_SECRET = process.env.START_TOKEN_SECRET || "";

/* --- mini audit --- */
type DenyWhy =
  | "server_env_missing"
  | "missing_bearer"
  | "bad_bearer"
  | "missing_sig"
  | "bad_sig"
  | "missing_params"
  | "bad_json"
  | "bad_start_token"
  | "bad_payload"
  | "unknown_jti"
  | "expired";

function redactTail(v?: string | null) {
  if (!v) return v;
  const s = v.replace(/^Bearer\s+/i, "");
  return `***${s.slice(-4)}`;
}
function auditDeny(reason: DenyWhy, req: NextRequest, extra: Record<string, unknown> = {}) {
  const rid = req.headers.get("x-request-id") || crypto.randomUUID();
  const h = req.headers;
  const log = {
    level: "warn",
    at: new Date().toISOString(),
    rid,
    reason,
    path: new URL(req.url).pathname,
    ua: h.get("user-agent") || undefined,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim(),
    has_auth: !!h.get("authorization"),
    bearer_tail: redactTail(h.get("authorization")),
    has_sig: !!h.get("x-brainbot-signature"),
    sig_tail: redactTail(h.get("x-brainbot-signature")),
    ...extra,
  };
  console.warn(JSON.stringify(log));
  return rid;
}
/* --- /mini audit --- */

function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  const a = Buffer.from((aHex || "").trim().toLowerCase(), "hex");
  const b = Buffer.from((bHex || "").trim().toLowerCase(), "hex");
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
function signHex(secret: string, raw: string): string {
  return crypto.createHmac("sha256", secret).update(raw, "utf8").digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    if (!HMAC || !SERVICE_TOKEN || !START_SECRET) {
      const rid = auditDeny("server_env_missing", req);
      return NextResponse.json({ ok: false, msg: "server env missing" }, { status: 500, headers: { "x-request-id": rid } });
    }

    // Bearer
    const auth = req.headers.get("authorization") || "";
    const bearer = auth.replace(/^Bearer\s+/i, "");
    if (!bearer) {
      const rid = auditDeny("missing_bearer", req);
      return NextResponse.json({ ok: false, msg: "unauthorized (token)" }, { status: 401, headers: { "x-request-id": rid } });
    }
    if (bearer !== SERVICE_TOKEN) {
      const rid = auditDeny("bad_bearer", req);
      return NextResponse.json({ ok: false, msg: "unauthorized (token)" }, { status: 401, headers: { "x-request-id": rid } });
    }

    // Raw + HMAC
    const raw = await req.text();
    const given = req.headers.get("x-brainbot-signature");
    if (!given) {
      const rid = auditDeny("missing_sig", req);
      return NextResponse.json({ ok: false, msg: "unauthorized (signature)" }, { status: 401, headers: { "x-request-id": rid } });
    }
    const expected = signHex(HMAC, raw);
    if (!timingSafeEqualHex(given, expected)) {
      const rid = auditDeny("bad_sig", req);
      return NextResponse.json({ ok: false, msg: "unauthorized (signature)" }, { status: 401, headers: { "x-request-id": rid } });
    }

    // JSON parse
    let body: any;
    try { body = JSON.parse(raw); }
    catch {
      const rid = auditDeny("bad_json", req);
      return NextResponse.json({ ok: false, msg: "invalid json" }, { status: 400, headers: { "x-request-id": rid } });
    }

    const { token, telegramId } = body as { token?: string; telegramId?: string };
    if (!token || !telegramId) {
      const rid = auditDeny("missing_params", req);
      return NextResponse.json({ ok: false, msg: "missing params" }, { status: 400, headers: { "x-request-id": rid } });
    }

    // Verify start token
    const pref = token.startsWith("st_") ? token.slice(3) : token;
    const v = verifyHS256(pref, START_SECRET);
    if (!v.ok) {
      const rid = auditDeny("bad_start_token", req, { err: v.err });
      return NextResponse.json({ ok: false, msg: v.err ?? "bad token" }, { status: 400, headers: { "x-request-id": rid } });
    }

    const { jti, sub: wid, exp, plan } = v.payload || {};
    if (!jti || !wid) {
      const rid = auditDeny("bad_payload", req);
      return NextResponse.json({ ok: false, msg: "bad payload" }, { status: 400, headers: { "x-request-id": rid } });
    }

    // Mongo (idempotent)
    const database = await db();
    const tokens = database.collection("link_tokens");
    const links = database.collection("user_links");

    const doc = await tokens.findOne<{ jti: string; used?: boolean; exp?: number }>({ jti });
    if (!doc) {
      const rid = auditDeny("unknown_jti", req);
      return NextResponse.json({ ok: false, msg: "unknown jti" }, { status: 404, headers: { "x-request-id": rid } });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = typeof doc.exp === "number" ? doc.exp : (typeof exp === "number" ? exp : 0);
    if (expSec && nowSec > expSec) {
      const rid = auditDeny("expired", req);
      return NextResponse.json({ ok: false, msg: "expired" }, { status: 410, headers: { "x-request-id": rid } });
    }

    await tokens.updateOne(
      { jti, used: { $ne: true } },
      { $set: { used: true, claimedBy: String(telegramId), claimedAt: new Date().toISOString() } }
    );

    await links.updateOne(
      { wid: String(wid) },
      {
        $set: {
          wid: String(wid),
          telegramId: String(telegramId),
          linkedAt: new Date().toISOString(),
          plan: String(plan || "free").toLowerCase(),
        },
      },
      { upsert: true }
    );

    // happy path
    const rid = req.headers.get("x-request-id") || crypto.randomUUID();
    console.info(JSON.stringify({ level: "info", at: new Date().toISOString(), rid, reason: "ok", path: new URL(req.url).pathname }));
    return NextResponse.json(
      { ok: true, wid: String(wid), telegramId: String(telegramId), plan: String(plan || "free") },
      { headers: { "x-request-id": rid } }
    );
  } catch (err: any) {
    const rid = crypto.randomUUID();
    console.error(JSON.stringify({ level: "error", at: new Date().toISOString(), rid, msg: err?.message || "server error" }));
    return NextResponse.json({ ok: false, msg: "server error" }, { status: 500, headers: { "x-request-id": rid } });
  }
}
