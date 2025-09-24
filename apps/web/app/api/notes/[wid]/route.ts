// apps/web/app/api/notes/[wid]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type LinkDoc = { wid: string; telegramId?: number };
type FeedbackDoc = { telegramId: number; weakTopics?: string[] };

export async function GET(_: Request, { params }: { params: { wid?: string } }) {
  try {
    const wid = (params.wid || "").trim();
    if (!wid) {
      return NextResponse.json({ ok: false, msg: "missing wid" }, { status: 400 });
    }

    const database = await db();
    const links = database.collection<LinkDoc>("user_links");
    const latest = database.collection<FeedbackDoc>("latest_feedback");

    const link = await links.findOne({ wid }, { projection: { telegramId: 1 } });
    if (!link?.telegramId) {
      return NextResponse.json({ ok: true, topics: [] });
    }

    const row = await latest.findOne(
      { telegramId: link.telegramId },
      { projection: { weakTopics: 1 } }
    );

    return NextResponse.json({ ok: true, topics: row?.weakTopics ?? [] });
  } catch (err) {
    console.error("GET /api/notes/[wid] failed:", err);
    return NextResponse.json({ ok: false, msg: "server error" }, { status: 500 });
  }
}
