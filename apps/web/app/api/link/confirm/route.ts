// apps/web/app/api/link/confirm/route.ts
import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyHS256 } from "@/lib/jwt";

const HMAC = process.env.SESSION_WEBHOOK_SECRET!;
const START_SECRET = process.env.START_TOKEN_SECRET!;

/** Verify request signature from bot (HMAC: sha256(body, SECRET) in hex). */
function verifySignature(body: string, sig: string | null): boolean {
  if (!sig) return false;

  // Bot sends hex; compute hex and compare as bytes
  const calcHex = crypto.createHmac("sha256", HMAC).update(body).digest("hex");
  const a = Buffer.from(calcHex, "hex");
  const b = Buffer.from(sig, "hex");

  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const sig = req.headers.get("x-brainbot-signature");

    if (!verifySignature(raw, sig)) {
      return NextResponse.json({ ok: false, msg: "invalid signature" }, { status: 401 });
    }

    const { token, telegramId } = JSON.parse(raw) as { token: string; telegramId: number };
    if (!token || !telegramId) {
      return NextResponse.json({ ok: false, msg: "missing params" }, { status: 400 });
    }

    // Accept optional "st_" prefix
    const pref = token.startsWith("st_") ? token.slice(3) : token;
    const v = verifyHS256(pref, START_SECRET);
    if (!v.ok) {
      return NextResponse.json({ ok: false, msg: v.err ?? "bad token" }, { status: 400 });
    }

    const { jti, sub: wid, exp, plan } = v.payload || {};
    if (!jti || !wid) {
      return NextResponse.json({ ok: false, msg: "bad payload" }, { status: 400 });
    }

    const database = await db();
    const tokens = database.collection("link_tokens");
    const links = database.collection("user_links");

    const doc = await tokens.findOne<{ jti: string; used?: boolean; exp?: number }>({ jti });
    if (!doc) {
      return NextResponse.json({ ok: false, msg: "unknown jti" }, { status: 404 });
    }
    if (doc.used) {
      return NextResponse.json({ ok: true, already: true, wid, telegramId });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = typeof doc.exp === "number" ? doc.exp : (typeof exp === "number" ? exp : 0);
    if (expSec && nowSec > expSec) {
      return NextResponse.json({ ok: false, msg: "expired" }, { status: 410 });
    }

    // Mark token used (idempotent guard)
    await tokens.updateOne(
      { jti, used: { $ne: true } },
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
          plan: (plan || "free").toString().toLowerCase(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ ok: true, wid, telegramId });
  } catch (err) {
    console.error("POST /api/link/confirm failed:", err);
    return NextResponse.json({ ok: false, msg: "server error" }, { status: 500 });
  }
}
