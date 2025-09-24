// apps/web/app/api/trends/[wid]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type PerfDoc = {
  createdAt?: string;
  subjectLabel?: string;
  gradeNumeric?: number | null;
  telegramId?: number | string;
};

export async function GET(_: Request, { params }: { params: { wid?: string } }) {
  try {
    const wid = (params.wid || "").trim();
    if (!wid) {
      return NextResponse.json({ ok: false, msg: "missing wid" }, { status: 400 });
    }

    const database = await db();
    const links = database.collection<{ wid: string; telegramId?: number | string }>("user_links");

    // Only fetch telegramId
    const link = await links.findOne({ wid }, { projection: { telegramId: 1 } });
    if (!link?.telegramId && link?.telegramId !== 0) {
      return NextResponse.json({ ok: true, points: [] });
    }

    // Handle either string or number storage for telegramId
    const tg = link.telegramId as number | string;
    const tgNum = typeof tg === "number" ? tg : Number(tg);
    const tgStr = typeof tg === "string" ? tg : String(tg);

    const perfColl = database.collection<PerfDoc>("performances");
    const perf = await perfColl
      .find({ telegramId: { $in: [tg, tgNum, tgStr] } })
      .project({ createdAt: 1, subjectLabel: 1, gradeNumeric: 1, _id: 0 })
      .sort({ createdAt: 1 })
      .limit(200)
      .toArray();

    // Normalize to chart-friendly points
    const points = (perf || []).map((p) => ({
      t: p.createdAt ?? null,
      s: p.subjectLabel ?? "",
      y: typeof p.gradeNumeric === "number" ? p.gradeNumeric : 0,
    })).filter(pt => pt.t && pt.s); // drop empties

    return NextResponse.json({ ok: true, points });
  } catch (err) {
    console.error("GET /api/trends/[wid] failed:", err);
    return NextResponse.json({ ok: false, msg: "server error" }, { status: 500 });
  }
}
