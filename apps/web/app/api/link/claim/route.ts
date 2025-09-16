import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const SECRET = process.env.SESSION_WEBHOOK_SECRET!;

function ok(body: string, sig: string | null) {
  if (!sig) return false;
  const h = crypto.createHmac("sha256", SECRET).update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(sig));
}

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-brainbot-signature");
  if (!ok(raw, sig)) return NextResponse.json({ ok: false }, { status: 401 });

  const { code, telegramId } = JSON.parse(raw) as { code: string; telegramId: number };
  if (!code || !telegramId) return NextResponse.json({ ok: false }, { status: 400 });

  const database = await db();
  const codes = database.collection("link_codes");
  const doc = await codes.findOne({ code });

  if (!doc) return NextResponse.json({ ok: false, msg: "not found" }, { status: 404 });
  if (doc.claimedBy) return NextResponse.json({ ok: true, already: true });
  if (Date.now() > Date.parse(doc.expiresAt)) return NextResponse.json({ ok: false, msg: "expired" }, { status: 410 });

  await codes.updateOne(
    { code },
    { $set: { claimedBy: telegramId, claimedAt: new Date().toISOString() } }
  );

  return NextResponse.json({ ok: true });
}
