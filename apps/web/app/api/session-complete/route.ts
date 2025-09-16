import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const { telegramId } = await req.json();
  const database = await db();
  const perf = database.collection("performances");

  // …your existing insert/save logic above…

  const [stats] = await perf
    .aggregate([
      { $match: { telegramId } },
      { $addFields: { _effectiveFinishedAt: { $ifNull: ["$finishedAt", "$createdAt"] } } },
      {
        $facet: {
          top: [
            { $sort: { _effectiveFinishedAt: -1 } },
            { $limit: 1 },
            { $project: { _id: 0, recentWeak: { $ifNull: ["$weakTopics", []] }, lastFinishedAt: "$_effectiveFinishedAt" } },
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
          lastFinishedAt: { $arrayElemAt: ["$top.lastFinishedAt", 0] },
        },
      },
    ])
    .toArray();

  return NextResponse.json(
    stats ?? { papersDone: 0, bestScore: 0, recentWeak: [], lastFinishedAt: null }
  );
}
