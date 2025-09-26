// apps/bot/src/db/ensureIndexes.ts
import mongoose from "mongoose";
import { SessionModel } from "../models/Session.js";
import { PerformanceModel } from "../models/Performance.js";
import { DrillLogModel } from "../models/DrillLog.js"; // if not present, comment out

type IndexKeys = Record<string, 1 | -1>;
type IndexOpts = Record<string, any>;

/** Quietly create an index; ignore “already exists / options conflict” noise. */
async function safeCreateIndex(
  coll: { createIndex: (keys: IndexKeys, opts?: IndexOpts) => Promise<any> },
  keys: IndexKeys,
  options: IndexOpts = {}
) {
  try {
    // background is ignored by modern Mongo but harmless to pass
    await coll.createIndex(keys, { background: true, ...options });
  } catch (e: any) {
    const code = e?.code;
    const codeName = e?.codeName;
    const msg = String(e?.message || "");
    const isConflict =
      code === 85 ||
      codeName === "IndexOptionsConflict" ||
      /index already exists/i.test(msg) ||
      /already exists with different name/i.test(msg) ||
      /cannot create index with same name/i.test(msg);
    if (!isConflict) throw e;
  }
}

/**
 * Call this ONCE after connectMongo().
 * Safe to call at every boot; it’s idempotent and conflict-tolerant.
 * You can disable via ENSURE_INDEXES=0 for ultra-fast cold starts.
 */
export async function ensureBotIndexes(): Promise<void> {
  if (process.env.ENSURE_INDEXES === "0") {
    console.warn("⚠️  ensureBotIndexes: skipped (ENSURE_INDEXES=0)");
    return;
  }

  // 1) Ensure schema-bound indexes first (Mongoose models)
  await Promise.allSettled([
    SessionModel.syncIndexes(),            // includes TTL/unique if defined in schema
    PerformanceModel.syncIndexes?.() ?? Promise.resolve(),
    DrillLogModel?.syncIndexes?.() ?? Promise.resolve(),
  ]);

  // 2) Native collections (requires an active connection)
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error(
      "ensureBotIndexes: mongoose.connection.db is not ready (call connectMongo() first)"
    );
  }

  // Known collections
  const latestFeedback = db.collection("latest_feedback");
  const performances   = db.collection("performances");
  const payments       = db.collection("payments");       // from c2b-confirmation route
  const drillLogs      = db.collection("drilllogs");      // if your collection is different, adjust

  // latest_feedback: unique by telegramId for easy upsert + sort helpers
  await safeCreateIndex(latestFeedback, { telegramId: 1 }, { name: "latest_feedback_tg_u", unique: true, sparse: true });
  await safeCreateIndex(latestFeedback, { finishedAt: -1 }, { name: "latest_feedback_finishedAt" });
  await safeCreateIndex(latestFeedback, { createdAt: -1 },  { name: "latest_feedback_createdAt" });

  // performances: fast scans by user/time/subject
  await safeCreateIndex(performances, { telegramId: 1, createdAt: -1 }, { name: "perf_tg_created" });
  await safeCreateIndex(performances, { telegramId: 1, subjectLabel: 1, createdAt: -1 }, { name: "perf_tg_subject_created" });

  // payments: strong idempotency anchors (receipt, checkoutId), plus common filters
  await safeCreateIndex(payments, { receipt: 1 },   { name: "pay_receipt_u", unique: true, sparse: true });
  await safeCreateIndex(payments, { checkoutId: 1 },{ name: "pay_checkout_u", unique: true, sparse: true });
  await safeCreateIndex(payments, { telegramId: 1, createdAt: -1 }, { name: "pay_tg_created" });
  await safeCreateIndex(payments, { tier: 1, createdAt: -1 },       { name: "pay_tier_created" });

  // drill logs (optional but useful for analytics)
  await safeCreateIndex(drillLogs, { telegramId: 1, createdAt: -1 }, { name: "drill_tg_created" });
  await safeCreateIndex(drillLogs, { subject: 1, topic: 1, createdAt: -1 }, { name: "drill_subject_topic_created" });

  console.log("✅ ensureBotIndexes: all good");
}

/* Convenience default export if you prefer `import ensureBotIndexes from ...` */
export default ensureBotIndexes;
