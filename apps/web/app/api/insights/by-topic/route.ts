import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const wid = url.searchParams.get("wid");
  const subject = url.searchParams.get("subject");
  const topic = url.searchParams.get("topic");
  if (!wid || !subject || !topic) return NextResponse.json({ ok: false, msg: "missing params" }, { status: 400 });

  const database = await db();
  const link = await database.collection("user_links").findOne({ wid });
  if (!link?.telegramId) return NextResponse.json({ ok: true, tip: null });

  // Look up a cached insight; fall back to null if you haven't populated it yet
  const row = await database.collection("insights") // create if/when bot writes here
    .findOne({ telegramId: link.telegramId, subjectLabel: subject, topic });

  // Keep it short for tooltips
  const tip = row?.tip || row?.summary || null;
  return NextResponse.json({ ok: true, tip });
}
