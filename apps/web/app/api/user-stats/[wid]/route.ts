// apps/web/app/api/user-stats/[wid]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type LinkDoc = { wid: string; telegramId?: number | string | null; plan?: string | null };
type StatsDoc = { telegramId: number | string; plan?: string; papersDone?: number; bestScore?: number; weakTopics?: string[]; lastFinishedAt?: string | null };
type LatestDoc = { telegramId: number | string; subjectLabel: string; gradeNumeric?: number | null; gradeText?: string; weakTopics?: string[]; startedAt?: string; finishedAt?: string; createdAt?: string };

export async function GET(_: Request, { params }: { params: { wid?: string } }) {
  try {
    const wid = (params.wid || "").trim();
    if (!wid) {
      return NextResponse.json({ ok: false, msg: "missing wid" }, { status: 400 });
    }

    const database = await db();
    const links = database.collection<LinkDoc>("user_links");

    // Who is this web user?
    const link = await links.findOne({ wid }, { projection: { telegramId: 1, plan: 1 } });

    if (!link?.telegramId && link?.telegramId !== 0) {
      return NextResponse.json({
        ok: true,
        wid,
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

    // Be robust to number/string storage
    const tg = link.telegramId as number | string;
    const tgNum = typeof tg === "number" ? tg : Number(tg);
    const tgStr = typeof tg === "string" ? tg : String(tg);

    const statsColl = database.collection<StatsDoc>("user_stats");
    const latestColl = database.collection<LatestDoc>("latest_feedback");

    const stats =
      (await statsColl.findOne(
        { telegramId: { $in: [tg, tgNum, tgStr] } },
        { projection: { plan: 1, papersDone: 1, bestScore: 1, weakTopics: 1, lastFinishedAt: 1, _id: 0 } }
      )) ||
      {
        plan: link.plan ?? "free",
        papersDone: 0,
        bestScore: 0,
        weakTopics: [],
        lastFinishedAt: null,
      };

    const latest =
      (await latestColl.findOne(
        { telegramId: { $in: [tg, tgNum, tgStr] } },
        { projection: { subjectLabel: 1, gradeNumeric: 1, gradeText: 1, weakTopics: 1, startedAt: 1, finishedAt: 1, createdAt: 1, _id: 0 } }
      )) || null;

    return NextResponse.json({
      ok: true,
      wid,
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
            gradeNumeric: latest.gradeNumeric ?? null,
            gradeText: latest.gradeText ?? null,
            weakTopics: latest.weakTopics ?? [],
            startedAt: latest.startedAt ?? null,
            finishedAt: latest.finishedAt ?? null,
            createdAt: latest.createdAt ?? null,
          }
        : null,
    });
  } catch (err) {
    console.error("GET /api/user-stats/[wid] failed:", err);
    return NextResponse.json({ ok: false, msg: "server error" }, { status: 500 });
  }
}
