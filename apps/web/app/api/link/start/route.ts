// apps/web/app/api/link/start/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Generate a 6-digit code, always padded to avoid leading-zero issues. */
function makeCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST() {
  try {
    const database = await db();
    const codes = database.collection("link_codes");

    const code = makeCode();
    const now = new Date();
    const expires = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

    await codes.insertOne({
      code,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      claimedBy: null,
      claimedAt: null,
    });

    return NextResponse.json({ ok: true, code, expiresAt: expires.toISOString() });
  } catch (err) {
    console.error("POST /api/link/start failed:", err);
    return NextResponse.json({ ok: false, msg: "server error" }, { status: 500 });
  }
}
