// apps/web/lib/analytics/indexes.ts
import { Db } from "mongodb";

/**
 * Ensures analytics-related indexes exist (idempotent).
 * Pass Db to avoid circular imports with db().
 */
export async function ensureAnalyticsIndexes(database: Db) {
  const col = database.collection("drill_logs");
  const created: string[] = [];

  await col.createIndex({ startedAt: -1 }, { name: "startedAt_desc", background: true });
  created.push("startedAt_desc");

  await col.createIndex(
    { subjectLabel: 1, startedAt: -1 },
    { name: "subject_startedAt", background: true }
  );
  created.push("subject_startedAt");

  await col.createIndex(
    { topic: 1, startedAt: -1 },
    { name: "topic_startedAt", background: true }
  );
  created.push("topic_startedAt");

  await col.createIndex(
    { telegramId: 1, startedAt: -1 },
    { name: "user_startedAt", background: true }
  );
  created.push("user_startedAt");

  return { created };
}
