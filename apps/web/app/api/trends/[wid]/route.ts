import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_: Request, { params }: { params: { wid: string } }) {
  const database = await db();
  const link = await database.collection("user_links").findOne({ wid: params.wid });
  if (!link?.telegramId) return NextResponse.json({ ok: true, points: [] });

  const perf = await database
    .collection("performances")
    .find({ telegramId: String(link.telegramId) })
    .project({ createdAt: 1, subjectLabel: 1, gradeNumeric: 1 })
    .sort({ createdAt: 1 })
    .limit(200)
    .toArray();

  const points = perf.map((p: any) => ({
    t: p.createdAt,
    s: p.subjectLabel,
    y: p.gradeNumeric ?? 0,
  }));

  return NextResponse.json({ ok: true, points });
}
