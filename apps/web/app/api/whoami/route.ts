export const dynamic = 'force-dynamic';
// apps/web/app/api/whoami/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type LinkDoc = { wid: string; telegramId?: number | string | null };

export async function GET(req: Request) {
  try {
    const wid = new URL(req.url).searchParams.get("wid")?.trim();
    if (!wid) {
      return NextResponse.json({ ok: false, msg: "missing wid" }, { status: 400 });
    }

    const database = await db();
    const link = await database
      .collection<LinkDoc>("user_links")
      .findOne({ wid }, { projection: { telegramId: 1 } });

    return NextResponse.json({
      ok: true,
      wid,
      telegramId: link?.telegramId ?? null,
    });
  } catch (err) {
    console.error("GET /api/whoami failed:", err);
    return NextResponse.json({ ok: false, msg: "server error" }, { status: 500 });
  }
}
