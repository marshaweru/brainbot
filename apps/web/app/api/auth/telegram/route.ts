import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { MongoClient } from "mongodb";

export const runtime = "nodejs";

// Config knobs (all optional except TELEGRAM_BOT_TOKEN + WEB_SESSION_SECRET)
const MAX_AGE_SEC = Number(process.env.TELEGRAM_LOGIN_MAX_AGE ?? 86_400); // 24h
const SESSION_DAYS = Number(process.env.WEB_SESSION_DAYS ?? 30);

// --- Telegram verification (unchanged math, extra guards) ---
function checkTelegramAuth(data: Record<string, any>) {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  if (!token) return false;

  const secret = crypto.createHash("sha256").update(token).digest();
  const receivedHash = String(data.hash || "");

  const dataCheckString = Object.entries(data)
    .filter(([k]) => k !== "hash")
    .map(([k, v]) => `${k}=${v}`)
    .sort() // lexicographic; matches Telegram docs
    .join("\n");

  const hmac = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(receivedHash));
}

// --- tiny JWT-ish token (HMAC-SHA256) for the session cookie ---
function b64url(s: Buffer | string) {
  return Buffer.from(s)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
function signSession(payload: object) {
  const secret = process.env.WEB_SESSION_SECRET;
  if (!secret) throw new Error("WEB_SESSION_SECRET missing");
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

// Optional: persist to Mongo if configured (no-op if not)
async function upsertUser(user: {
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  photoUrl?: string | null;
}) {
  const uri = process.env.MONGODB_URI;
  if (!uri) return;

  const dbName = process.env.MONGODB_DB || "brainbot_web";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    await db.collection("users").updateOne(
      { telegramId: user.telegramId },
      {
        $set: { ...user, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
  } finally {
    await client.close().catch(() => {});
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json().catch(() => null);
    if (!data || !data.id || !data.auth_date || !data.hash) {
      return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
    }

    if (!checkTelegramAuth(data)) {
      return NextResponse.json({ ok: false, error: "invalid hash" }, { status: 401 });
    }

    // Freshness guard per Telegram docs (auth_date is seconds)
    const now = Math.floor(Date.now() / 1000);
    const authDate = Number(data.auth_date);
    if (!Number.isFinite(authDate) || now - authDate > MAX_AGE_SEC) {
      return NextResponse.json({ ok: false, error: "stale login" }, { status: 401 });
    }

    const user = {
      telegramId: String(data.id),
      username: data.username || null,
      firstName: data.first_name || null,
      lastName: data.last_name || null,
      photoUrl: data.photo_url || null,
    };

    await upsertUser(user).catch(() => { /* optional DB */ });

    // Session: sub = telegramId, exp in seconds
    const exp = now + SESSION_DAYS * 86_400;
    const token = signSession({ sub: user.telegramId, username: user.username, exp });

    const res = NextResponse.json({ ok: true, user: { id: user.telegramId, username: user.username } });
    res.cookies.set("bb_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DAYS * 86_400,
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "server error" }, { status: 500 });
  }
}
