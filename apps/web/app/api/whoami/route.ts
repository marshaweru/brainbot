import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const wid = new URL(req.url).searchParams.get("wid");
  if (!wid) return NextResponse.json({ ok: false }, { status: 400 });

  const database = await db();
  const link = await database.collection("user_links").findOne({ wid });
  return NextResponse.json({ ok: true, telegramId: link?.telegramId ?? null });
}
