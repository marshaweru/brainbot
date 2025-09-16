import { Db } from "mongodb";

export async function ensureWebIndexes(db: Db) {
  // user_links
  await db.collection("user_links").createIndex({ wid: 1 }, { unique: true, name: "user_links_wid_u" });
  await db.collection("user_links").createIndex({ telegramId: 1 }, { unique: true, name: "user_links_tg_u" });

  // user_stats
  await db.collection("user_stats").createIndex({ telegramId: 1 }, { unique: true, name: "user_stats_tg_u" });
  await db.collection("user_stats").createIndex({ lastFinishedAt: -1 }, { name: "user_stats_lastFinishedAt" });

  // latest_feedback
  await db.collection("latest_feedback").createIndex({ telegramId: 1 }, { unique: true, name: "latest_feedback_tg_u" });
  await db.collection("latest_feedback").createIndex({ finishedAt: -1 }, { name: "latest_feedback_finishedAt" });
  await db.collection("latest_feedback").createIndex({ createdAt: -1 }, { name: "latest_feedback_createdAt" });

  // performances
  await db.collection("performances").createIndex({ telegramId: 1, createdAt: -1 }, { name: "perf_tg_created" });
  await db.collection("performances").createIndex({ telegramId: 1, subjectLabel: 1, createdAt: -1 }, { name: "perf_tg_subject_created" });

  // insights (optional)
  await db.collection("insights").createIndex({ telegramId: 1, subjectLabel: 1, topic: 1 }, { name: "insights_tg_subject_topic" });

  // link_tokens (TTL)
  await db.collection("link_tokens").createIndex({ jti: 1 }, { unique: true, name: "link_tokens_jti_u" });
  await db.collection("link_tokens").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "link_tokens_expires_ttl" });

  // link_codes (TTL)
  await db.collection("link_codes").createIndex({ code: 1 }, { unique: true, name: "link_codes_code_u" });
  await db.collection("link_codes").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "link_codes_expires_ttl" });

  console.log("✅ Web indexes ensured");
}
