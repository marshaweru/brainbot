export const dynamic = 'force-dynamic';
// apps/web/app/api/link/status/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ ok: false, msg: "missing code" }, { status: 400 });
    }

    const database = await db();
    const doc = await database.collection("link_codes").findOne<{ 
      code: string; 
      expiresAt?: string; 
      claimedBy?: number | null; 
    }>({ code });

    if (!doc) {
      return NextResponse.json({ ok: true, found: false });
    }

    const now = Date.now();
    const expired = doc.expiresAt ? now > Date.parse(doc.expiresAt) : false;

    return NextResponse.json({
      ok: true,
      found: true,
      expired,
      claimed: !!doc.claimedBy,
      claimedBy: doc.claimedBy ?? null,
    });
  } catch (err) {
    console.error("GET /api/link/status failed:", err);
    return NextResponse.json({ ok: false, msg: "server error" }, { status: 500 });
  }
}
