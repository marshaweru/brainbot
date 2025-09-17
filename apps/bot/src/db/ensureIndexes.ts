// apps/bot/src/db/ensureIndexes.ts
import mongoose from "mongoose";
import { SessionModel } from "../models/Session.js";
import { PerformanceModel } from "../models/Performance.js";

/** Create an index but quietly ignore conflicts/duplicates. */
async function safeCreateIndex(
  coll: any,                                    // <- loosened typing to avoid TS friction
  keys: Record<string, 1 | -1>,
  options: Record<string, any> = {}
) {
  try {
    await coll.createIndex(keys, { background: true, ...options });
  } catch (e: any) {
    const code = e?.code;
    const name = e?.codeName;
    const msg = String(e?.message || "");
    const isConflict =
      code === 85 ||
      name === "IndexOptionsConflict" ||
      /index already exists/i.test(msg) ||
      /already exists with different name/i.test(msg);
    if (!isConflict) throw e;
  }
}

/**
 * Idempotent: safe to call at every boot AFTER connectMongo().
 * - Sync Mongoose-defined indexes.
 * - Add our extra compound indexes with conflict tolerance.
 */
export async function ensureBotIndexes(): Promise<void> {
  // 1) Mongoose schema-bound indexes
  await Promise.allSettled([
    SessionModel.syncIndexes(),                // includes TTL/uniques defined in schema
    PerformanceModel.syncIndexes?.() ?? Promise.resolve(),
  ]);

  // 2) Native collections (guard for undefined db)
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("ensureBotIndexes: mongoose.connection.db is not ready (did you call connectMongo() first?)");
  }

  const latestFeedback = db.collection("latest_feedback");
  const performances   = db.collection("performances");

  // latest_feedback: unique by telegramId for easy upsert + time helpers
  await safeCreateIndex(latestFeedback, { telegramId: 1 }, { name: "latest_feedback_tg_u", unique: true });
  await safeCreateIndex(latestFeedback, { finishedAt: -1 }, { name: "latest_feedback_finishedAt" });
  await safeCreateIndex(latestFeedback, { createdAt: -1 },  { name: "latest_feedback_createdAt" });

  // performances: fast scans by user/time/subject
  await safeCreateIndex(performances, { telegramId: 1, createdAt: -1 }, { name: "perf_tg_created" });
  await safeCreateIndex(performances, { telegramId: 1, subjectLabel: 1, createdAt: -1 }, { name: "perf_tg_subject_created" });
}
