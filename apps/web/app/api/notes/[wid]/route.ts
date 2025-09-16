import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_: Request, { params }: { params: { wid: string } }) {
  const database = await db();
  const link = await database.collection("user_links").findOne({ wid: params.wid });
  if (!link?.telegramId) return NextResponse.json({ ok: true, topics: [] });

  const latest = await database
    .collection("latest_feedback")
    .findOne({ telegramId: link.telegramId });

  return NextResponse.json({ ok: true, topics: latest?.weakTopics ?? [] });
}
