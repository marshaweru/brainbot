/**
 * Helper: try to create index, ignore if already exists with different spec.
 */
async function tryIndex(col, keys, opts) {
    try {
        await col.createIndex(keys, opts);
    }
    catch (err) {
        if (err?.codeName === "IndexOptionsConflict" ||
            err?.codeName === "IndexKeySpecsConflict" ||
            err?.code === 85 ||
            err?.code === 86) {
            console.warn(`⚠️  Skipped conflicting index on ${col.collectionName}: ${opts.name}`);
            return;
        }
        throw err;
    }
}
/** Idempotent: safe to call on boot. */
export async function ensureWebIndexes(db) {
    // user_links
    await tryIndex(db.collection("user_links"), { wid: 1 }, { unique: true, name: "user_links_wid_u" });
    await tryIndex(db.collection("user_links"), { telegramId: 1 }, { unique: true, sparse: true, name: "user_links_tg_u" });
    // user_stats
    await tryIndex(db.collection("user_stats"), { telegramId: 1 }, { unique: true, name: "user_stats_tg_u" });
    await tryIndex(db.collection("user_stats"), { lastFinishedAt: -1 }, { name: "user_stats_lastFinishedAt" });
    // latest_feedback
    await tryIndex(db.collection("latest_feedback"), { telegramId: 1 }, { unique: true, name: "latest_feedback_tg_u" });
    await tryIndex(db.collection("latest_feedback"), { finishedAt: -1 }, { name: "latest_feedback_finishedAt" });
    await tryIndex(db.collection("latest_feedback"), { createdAt: -1 }, { name: "latest_feedback_createdAt" });
    // performances
    await tryIndex(db.collection("performances"), { telegramId: 1, createdAt: -1 }, { name: "perf_tg_created" });
    await tryIndex(db.collection("performances"), { telegramId: 1, subjectLabel: 1, createdAt: -1 }, { name: "perf_tg_subject_created" });
    // insights
    await tryIndex(db.collection("insights"), { telegramId: 1, subjectLabel: 1, topic: 1 }, { name: "insights_tg_subject_topic" });
    // link_tokens (TTL)
    await tryIndex(db.collection("link_tokens"), { jti: 1 }, { unique: true, name: "link_tokens_jti_u" });
    await tryIndex(db.collection("link_tokens"), { expiresAt: 1 }, { expireAfterSeconds: 0, name: "link_tokens_expires_ttl" });
    // link_codes (TTL)
    await tryIndex(db.collection("link_codes"), { code: 1 }, { unique: true, name: "link_codes_code_u" });
    await tryIndex(db.collection("link_codes"), { expiresAt: 1 }, { expireAfterSeconds: 0, name: "link_codes_expires_ttl" });
    // users
    await tryIndex(db.collection("users"), { tier: 1 }, { name: "users_tier" });
    await tryIndex(db.collection("users"), { telegramId: 1 }, { name: "users_tg" });
    // payments
    await tryIndex(db.collection("payments"), { createdAt: -1 }, { name: "payments_createdAt" });
    await tryIndex(db.collection("payments"), { telegramId: 1, createdAt: -1 }, { name: "payments_tg_created" });
    // sessions
    await tryIndex(db.collection("sessions"), { updatedAt: -1 }, { name: "sessions_updatedAt" });
    await tryIndex(db.collection("sessions"), { telegramId: 1, updatedAt: -1 }, { name: "sessions_tg_updated" });
    console.log("✅ ensureWebIndexes: ensured");
}
