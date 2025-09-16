// apps/bot/src/repo/performanceRepo.ts
import { PerformanceModel, type PerformanceDoc } from "../models/Performance";
import type { FilterQuery } from "mongoose";

/**
 * Create one Performance row.
 * NOTE: Only fields in your Mongoose schema will persist (strict mode).
 */
export async function savePerformance(params: {
  telegramId: string;
  subjectLabel: string;
  gradeNumeric?: number | null;
  gradeText?: string | null;
  weakTopics?: string[] | null;
  feedback?: any;
  raw?: any;
  paper?: string | null;
  sessionId?: string | null;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
}) {
  const doc = await PerformanceModel.create({
    telegramId: params.telegramId,
    subjectLabel: params.subjectLabel,
    gradeNumeric: params.gradeNumeric ?? null,
    gradeText: params.gradeText ?? null,
    weakTopics: params.weakTopics ?? [],
    feedback: params.feedback ?? null,
    raw: params.raw ?? null,
    paper: params.paper ?? null,
    sessionId: params.sessionId ?? null,
    startedAt: params.startedAt ? new Date(params.startedAt) : undefined,
    finishedAt: params.finishedAt ? new Date(params.finishedAt) : undefined,
  });
  return doc.toObject() as PerformanceDoc;
}

/**
 * List recent performances for a user.
 * Sorts by finishedAt desc, then createdAt desc as fallback.
 */
export async function listRecent(telegramId: string, limit = 10) {
  const rows = await PerformanceModel.aggregate<PerformanceDoc>([
    { $match: { telegramId } },
    { $addFields: { _effectiveFinishedAt: { $ifNull: ["$finishedAt", "$createdAt"] } } },
    { $sort: { _effectiveFinishedAt: -1 } },
    { $limit: limit },
  ]);
  return rows;
}

/**
 * Optional filterable list (by subject, date range, etc.)
 */
export async function listBy(
  where: FilterQuery<PerformanceDoc>,
  { limit = 50, sort = { createdAt: -1 } }: { limit?: number; sort?: Record<string, 1 | -1> } = {}
) {
  return PerformanceModel.find(where).sort(sort).limit(limit).lean<PerformanceDoc[]>();
}

/**
 * Aggregate lightweight stats for dashboard or webhook sync:
 * - papersDone
 * - bestScore
 * - lastFinishedAt (prefers finishedAt, falls back to createdAt)
 * - recentWeak (weak topics from the most recent doc)
 */
export async function aggregateUserStats(telegramId: string) {
  const [agg] = await PerformanceModel.aggregate([
    { $match: { telegramId } },
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
        lastFinishedAt: { $arrayElemAt: ["$top.lastFinishedAt", 0] },
      },
    },
  ]);

  return (
    agg || {
      papersDone: 0,
      bestScore: 0,
      recentWeak: [] as string[],
      lastFinishedAt: null as Date | null,
    }
  );
}

/**
 * Convenience helper: save + return fresh aggregate.
 * Useful if you want to sync to the web immediately after marking.
 */
export async function saveAndAggregate(params: Parameters<typeof savePerformance>[0]) {
  await savePerformance(params);
  return aggregateUserStats(params.telegramId);
}

/**
 * One-time indexes — call once at startup (idempotent).
 * Speeds up per-user queries, bestScore aggregation, and sorting by finish time.
 */
export async function ensurePerformanceIndexes() {
  await PerformanceModel.collection.createIndex({ telegramId: 1, createdAt: -1 });
  await PerformanceModel.collection.createIndex({ telegramId: 1, finishedAt: -1 });
  await PerformanceModel.collection.createIndex({ telegramId: 1, gradeNumeric: -1 });
  await PerformanceModel.collection.createIndex({ subjectLabel: 1, createdAt: -1 });
  await PerformanceModel.collection.createIndex({ sessionId: 1 }, { sparse: true });
}
