// apps/bot/src/repo/performanceRepo.ts
import { PerformanceModel, type PerformanceDoc } from "../models/Performance.js";
import type { FilterQuery } from "mongoose";

/* ---------- Utils ---------- */
const toDate = (v: Date | string | null | undefined): Date | undefined => {
  if (!v) return undefined;
  if (v instanceof Date) return isNaN(v.getTime()) ? undefined : v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
};

/* ---------- Create ---------- */
export async function savePerformance(params: {
  telegramId: string;
  subjectLabel: string;
  gradeNumeric?: number | null;
  gradeText?: string | null;
  weakTopics?: string[] | null;
  feedback?: unknown;
  raw?: unknown;
  paper?: string | null;          // "1" | "2" | "3" stringy is fine
  sessionId?: string | null;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
}) {
  const doc = await PerformanceModel.create({
    telegramId: params.telegramId,
    subjectLabel: params.subjectLabel,
    gradeNumeric: params.gradeNumeric ?? null,
    gradeText: params.gradeText ?? null,
    weakTopics: Array.isArray(params.weakTopics) ? params.weakTopics : [],
    feedback: params.feedback ?? null,
    raw: params.raw ?? null,
    paper: params.paper ?? null,
    sessionId: params.sessionId ?? null,
    startedAt: toDate(params.startedAt),
    finishedAt: toDate(params.finishedAt),
  });
  return doc.toObject() as PerformanceDoc;
}

/* ---------- Reads ---------- */
export async function listRecent(telegramId: string, limit = 10) {
  const rows = await PerformanceModel.aggregate<PerformanceDoc>([
    { $match: { telegramId } },
    { $addFields: { _effectiveFinishedAt: { $ifNull: ["$finishedAt", "$createdAt"] } } },
    { $sort: { _effectiveFinishedAt: -1 } },
    { $limit: Math.max(1, Math.min(100, limit)) },
    { $project: { _effectiveFinishedAt: 0 } },
  ]);
  return rows;
}

export async function listBy(
  where: FilterQuery<PerformanceDoc>,
  opts: { limit?: number; sort?: Record<string, 1 | -1> } = {}
) {
  const { limit = 50, sort = { createdAt: -1 } } = opts;
  return PerformanceModel.find(where).sort(sort).limit(limit).lean<PerformanceDoc[]>();
}

/* ---------- Aggregates (User) ---------- */
export type UserPerfStats = {
  papersDone: number;
  bestScore: number;
  recentWeak: string[];
  lastFinishedAt: Date | null;
};

export async function aggregateUserStats(telegramId: string): Promise<UserPerfStats> {
  const [agg] = await PerformanceModel.aggregate([
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
        lastFinishedAt: { $ifNull: [{ $arrayElemAt: ["$top.lastFinishedAt", 0] }, null] },
      },
    },
  ]);

  return (
    (agg as UserPerfStats) || {
      papersDone: 0,
      bestScore: 0,
      recentWeak: [],
      lastFinishedAt: null,
    }
  );
}

export type UserPerfSubjectStats = {
  papersDone: number;
  bestScore: number;
  recentWeak: string[];
  lastFinishedAt: Date | null;
};

export async function aggregateUserStatsBySubject(
  telegramId: string,
  subjectLabel: string
): Promise<UserPerfSubjectStats> {
  const [agg] = await PerformanceModel.aggregate([
    { $match: { telegramId, subjectLabel } },
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
        lastFinishedAt: { $ifNull: [{ $arrayElemAt: ["$top.lastFinishedAt", 0] }, null] },
      },
    },
  ]);

  return (
    (agg as UserPerfSubjectStats) || {
      papersDone: 0,
      bestScore: 0,
      recentWeak: [],
      lastFinishedAt: null,
    }
  );
}

/* ---------- Aggregates (Leaderboard) ---------- */
export type SubjectLeaderboardRow = {
  telegramId: string;
  bestScore: number;
  lastFinishedAt: Date | null;
  papersDone: number;
};

export async function leaderboardBySubject(subjectLabel: string, limit = 10): Promise<SubjectLeaderboardRow[]> {
  const capped = Math.max(1, Math.min(50, limit));
  const rows = await PerformanceModel.aggregate<SubjectLeaderboardRow>([
    { $match: { subjectLabel } },
    { $addFields: { _effectiveFinishedAt: { $ifNull: ["$finishedAt", "$createdAt"] } } },
    {
      $group: {
        _id: "$telegramId",
        bestScore: { $max: "$gradeNumeric" },
        lastFinishedAt: { $max: "$_effectiveFinishedAt" },
        papersDone: { $sum: 1 },
      },
    },
    { $match: { bestScore: { $ne: null } } },
    { $sort: { bestScore: -1, lastFinishedAt: -1 } },
    { $limit: capped },
    {
      $project: {
        _id: 0,
        telegramId: "$_id",
        bestScore: { $ifNull: ["$bestScore", 0] },
        lastFinishedAt: { $ifNull: ["$lastFinishedAt", null] },
        papersDone: 1,
      },
    },
  ]);
  return rows;
}

/* ---------- Timeline for /progress ---------- */
export type TimelinePoint = {
  when: Date;
  score: number;
  subjectLabel: string;
  paper?: string | null;
  sessionId?: string | null;
};

export async function getScoresTimeline(
  telegramId: string,
  opts: { subjectLabel?: string; sinceDays?: number } = {}
): Promise<TimelinePoint[]> {
  const since = opts.sinceDays ? new Date(Date.now() - Math.max(1, opts.sinceDays) * 24 * 3600 * 1000) : null;
  const match: any = { telegramId, gradeNumeric: { $ne: null } };
  if (opts.subjectLabel) match.subjectLabel = opts.subjectLabel;
  if (since) match.$or = [{ finishedAt: { $gte: since } }, { createdAt: { $gte: since } }];

  const rows = await PerformanceModel.aggregate<TimelinePoint>([
    { $match: match },
    { $addFields: { _t: { $ifNull: ["$finishedAt", "$createdAt"] } } },
    { $sort: { _t: 1 } },
    {
      $project: {
        when: "$_t",
        score: "$gradeNumeric",
        subjectLabel: 1,
        paper: 1,
        sessionId: 1,
        _id: 0,
      },
    },
  ]);

  return rows.map((r) => ({
    ...r,
    score: Math.max(0, Math.min(100, Number(r.score ?? 0))),
    when: new Date(r.when),
  }));
}

/* ---------- Convenience ---------- */
export async function saveAndAggregate(params: Parameters<typeof savePerformance>[0]) {
  await savePerformance(params);
  return aggregateUserStats(params.telegramId);
}

/* ---------- Indexes ---------- */
export async function ensurePerformanceIndexes() {
  await PerformanceModel.collection.createIndex({ telegramId: 1, createdAt: -1 });
  await PerformanceModel.collection.createIndex({ telegramId: 1, finishedAt: -1 });
  await PerformanceModel.collection.createIndex({ telegramId: 1, gradeNumeric: -1 });
  await PerformanceModel.collection.createIndex({ subjectLabel: 1, createdAt: -1 });
  await PerformanceModel.collection.createIndex({ sessionId: 1 }, { sparse: true });
}
