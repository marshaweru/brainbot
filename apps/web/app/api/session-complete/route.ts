// apps/web/app/api/session-complete/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Optional: force Node runtime in case you add DB writes above later
export const runtime = "nodejs";

type Stats = {
  papersDone: number;
  bestScore: number;
  recentWeak: string[];
  lastFinishedAt: string | null;
};

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return NextResponse.json({ ok: false, msg: "expected application/json" }, { status: 415 });
    }

    const body = await req.json().catch(() => null);
    const telegramId = body?.telegramId;

    if (telegramId == null || (typeof telegramId !== "number" && typeof telegramId !== "string")) {
      return NextResponse.json({ ok: false, msg: "missing or invalid telegramId" }, { status: 400 });
    }

    // If you insert/save performance here, do it before stats aggregation.
    // e.g. await database.collection("performances").insertOne({ ...payload, telegramId, createdAt: new Date().toISOString() });

    const database = await db();
    const perf = database.collection("performances");

    const cursor = perf.aggregate<Stats>([
      { $match: { telegramId: typeof telegramId === "string" ? Number(telegramId) || telegramId : telegramId } },
      { $addFields: { _effectiveFinishedAt: { $ifNull: ["$finishedAt", "$createdAt"] } } },
      {
        $facet: {
          top: [
            { $sort: { _effectiveFinishedAt: -1 } },
            { $limit: 1 },
            {
              $project: {
                _id: 0,
                recentWeak: { $ifNull: ["$weakTopics", []] },
                lastFinishedAt: "$_effectiveFinishedAt",
              },
            },
          ],
          best: [
            { $match: { gradeNumeric: { $ne: null } } },
            { $group: { _id: "$telegramId", bestScore: { $max: "$gradeNumeric" } } },
          ],
          count: [{ $count: "papersDone" }],
        },
      },
      {
        $project: {
          papersDone: { $ifNull: [{ $arrayElemAt: ["$count.papersDone", 0] }, 0] },
          bestScore: { $ifNull: [{ $arrayElemAt: ["$best.bestScore", 0] }, 0] },
          recentWeak: { $ifNull: [{ $arrayElemAt: ["$top.recentWeak", 0] }, []] },
          lastFinishedAt: { $ifNull: [{ $arrayElemAt: ["$top.lastFinishedAt", 0] }, null] },
        },
      },
    ]);

    const [stats] = await cursor.toArray();

    const safe: Stats =
      stats ?? { papersDone: 0, bestScore: 0, recentWeak: [], lastFinishedAt: null };

    return NextResponse.json({ ok: true, stats: safe });
  } catch (err) {
    console.error("POST /api/session-complete failed:", err);
    return NextResponse.json({ ok: false, msg: "server error" }, { status: 500 });
  }
}
