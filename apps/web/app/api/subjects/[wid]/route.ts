import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_: Request, { params }: { params: { wid: string } }) {
  const database = await db();
  const link = await database.collection("user_links").findOne({ wid: params.wid });
  if (!link?.telegramId) return NextResponse.json({ ok: true, subjects: [] });

  const telegramId = String(link.telegramId);

  const perfSubjects = await database
    .collection("performances")
    .distinct("subjectLabel", { telegramId });

  const subjects = Array.from(new Set([...(perfSubjects || [])]))
    .filter(Boolean)
    .sort();

  return NextResponse.json({ ok: true, subjects });
}
