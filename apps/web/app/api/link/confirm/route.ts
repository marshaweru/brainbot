// apps/web/app/api/link/confirm/route.ts
import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyHS256 } from "@/lib/jwt";

const HMAC = process.env.SESSION_WEBHOOK_SECRET!;
const START_SECRET = process.env.START_TOKEN_SECRET!;

/**
 * Verify request signature from bot (HMAC).
 */
function ok(body: string, sig: string | null) {
  if (!sig) return false;
  const calc = crypto.createHmac("sha256", HMAC).update(body).digest("hex");
  const a = Buffer.from(calc);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-brainbot-signature");
  if (!ok(raw, sig)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { token, telegramId } = JSON.parse(raw) as { token: string; telegramId: number };
  if (!token || !telegramId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const pref = token.startsWith("st_") ? token.slice(3) : token;
  const v = verifyHS256(pref, START_SECRET);
  if (!v.ok) {
    return NextResponse.json({ ok: false, msg: v.err }, { status: 400 });
  }

  const { jti, sub: wid, exp, plan } = v.payload || {};
  if (!jti || !wid) {
    return NextResponse.json({ ok: false, msg: "bad payload" }, { status: 400 });
  }

  const database = await db();
  const tokens = database.collection("link_tokens");
  const links = database.collection("user_links");

  const doc = await tokens.findOne({ jti });
  if (!doc) {
    return NextResponse.json({ ok: false, msg: "unknown jti" }, { status: 404 });
  }
  if (doc.used) {
    return NextResponse.json({ ok: true, already: true, wid, telegramId });
  }
  if (Date.now() / 1000 > (doc.exp as number)) {
    return NextResponse.json({ ok: false, msg: "expired" }, { status: 410 });
  }

  // Mark token used
  await tokens.updateOne(
    { jti },
    { $set: { used: true, claimedBy: telegramId, claimedAt: new Date().toISOString() } }
  );

  // Upsert wid ↔ telegramId mapping
  await links.updateOne(
    { wid },
    {
      $set: {
        wid,
        telegramId,
        linkedAt: new Date().toISOString(),
        plan: (plan || "free").toLowerCase(),
      },
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true, wid, telegramId });
}
