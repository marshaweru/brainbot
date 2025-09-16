import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_: Request, { params }: { params: { wid: string } }) {
  const database = await db();

  // Who is this web user?
  const link = await database.collection("user_links").findOne({ wid: params.wid });
  if (!link?.telegramId) {
    return NextResponse.json({
      wid: params.wid,
      linked: false,
      stats: {
        plan: "free",
        papersDone: 0,
        bestScore: 0,
        weakTopics: [],
        lastFinishedAt: null,
      },
      latest: null,
    });
  }

  const telegramId = Number(link.telegramId);

  // Rolled-up stats (from /api/session-complete webhook)
  const stats =
    (await database.collection("user_stats").findOne({ telegramId })) || {
      plan: link.plan ?? "free",
      papersDone: 0,
      bestScore: 0,
      weakTopics: [],
      lastFinishedAt: null,
    };

  // Durable “latest feedback” snapshot
  const latest =
    (await database.collection("latest_feedback").findOne({ telegramId })) || null;

  return NextResponse.json({
    wid: params.wid,
    linked: true,
    stats: {
      plan: stats.plan ?? link.plan ?? "free",
      papersDone: stats.papersDone ?? 0,
      bestScore: stats.bestScore ?? 0,
      weakTopics: stats.weakTopics ?? [],
      lastFinishedAt: stats.lastFinishedAt ?? null,
    },
    latest: latest
      ? {
          subjectLabel: latest.subjectLabel,
          gradeNumeric: latest.gradeNumeric,
          gradeText: latest.gradeText,
          weakTopics: latest.weakTopics ?? [],
          startedAt: latest.startedAt,
          finishedAt: latest.finishedAt,
          createdAt: latest.createdAt,
        }
      : null,
  });
}
