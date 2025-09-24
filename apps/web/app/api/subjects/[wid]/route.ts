// apps/web/app/api/subjects/[wid]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type LinkDoc = { wid: string; telegramId?: number | string | null };

export async function GET(_: Request, { params }: { params: { wid?: string } }) {
  try {
    const wid = (params.wid || "").trim();
    if (!wid) {
      return NextResponse.json({ ok: false, msg: "missing wid" }, { status: 400 });
    }

    const database = await db();
    const links = database.collection<LinkDoc>("user_links");

    // Fetch only what we need
    const link = await links.findOne({ wid }, { projection: { telegramId: 1 } });
    if (!link?.telegramId && link?.telegramId !== 0) {
      return NextResponse.json({ ok: true, subjects: [] });
    }

    // Be robust to mixed storage types (string vs number)
    const tg = link.telegramId as number | string;
    const tgNum = typeof tg === "number" ? tg : Number(tg);
    const tgStr = typeof tg === "string" ? tg : String(tg);

    // Query for either representation
    const perfSubjects = await database
      .collection("performances")
      .distinct<string>("subjectLabel", { telegramId: { $in: [tg, tgNum, tgStr] } });

    // Dedupe, sanitize, sort
    const subjects = Array.from(
      new Set((perfSubjects || []).filter((s): s is string => !!s && typeof s === "string"))
    ).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ ok: true, subjects });
  } catch (err) {
    console.error("GET /api/subjects/[wid] failed:", err);
    return NextResponse.json({ ok: false, msg: "server error" }, { status: 500 });
  }
}
