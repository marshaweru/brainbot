// apps/bot/src/lib/perf.ts
import { getCollections } from "./db.js";
import type { SubjectSlug } from "../prompts/system.js";

export function parseScoreFromFeedback(feedback: string): number | null {
  const m1 = feedback.match(/(\d{1,3})\s*\/\s*100\b/);
  if (m1) { const n = Number(m1[1]); if (n >= 0 && n <= 100) return n; }
  const m2 = feedback.match(/(\d{1,3})\s*%/);
  if (m2) { const n = Number(m2[1]); if (n >= 0 && n <= 100) return n; }
  return null;
}

/** Insert one row per attempt (for 30-day window aggregation). */
export async function recordPaperOutcome(params: {
  telegramId: string;
  subject: SubjectSlug;
  paper?: "P1" | "P2" | "P3" | "Mixed";
  score?: number | null;
}) {
  const { perf } = await getCollections();
  const { telegramId, subject, paper = "Mixed", score = null } = params;
  await perf.insertOne({ telegramId, subject, paper, score, ts: new Date() });
}

/** Create helpful indexes, including a 90-day TTL on ts. Safe to call on startup. */
export async function ensurePerfIndexes() {
  const { perf } = await getCollections();
  // query speed
  await perf.createIndex({ telegramId: 1, subject: 1, paper: 1, ts: -1 });
  // TTL: auto-delete after 90 days
  // NOTE: requires built-in Mongo TTL monitor (runs ~every 60s)
  try {
    await perf.createIndex({ ts: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
  } catch {
    // ignore if already exists with different value; cron fallback will cover us
  }
}

/** Manual purge (fallback): delete anything older than N days. */
export async function purgeOldPerf(days = 90) {
  const { perf } = await getCollections();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const res = await perf.deleteMany({ ts: { $lt: cutoff } });
  return res?.deletedCount ?? 0;
}

/** 30-day weakness-aware suggestion (unchanged behavior) */
export async function suggestPaperFocus(
  telegramId: string,
  subject: SubjectSlug,
  contentHint: string
): Promise<"P1" | "P2" | "P3" | "Mixed"> {
  const { perf } = await getCollections();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rows = await perf.aggregate([
    { $match: { telegramId, subject, ts: { $gte: cutoff } } },
    { $group: { _id: "$paper", attempts: { $sum: 1 }, avgScore: { $avg: "$score" } } },
  ]).toArray();

  let weakest: { paper: "P1"|"P2"|"P3"|"Mixed"; avg: number; attempts: number } | null = null;
  for (const r of rows) {
    if (r.attempts >= 2 && r.avgScore < 60) {
      if (!weakest || r.avgScore < weakest.avg) weakest = { paper: r._id, avg: r.avgScore, attempts: r.attempts };
    }
  }
  if (weakest) return weakest.paper;

  // fallback heuristic (trimmed)
  const h = contentHint.toLowerCase();
  if (subject === "mat") return /(graph|quadratic|transformation|calculus|trigon|matrix|locus)/.test(h) ? "P2" : "P1";
  if (subject === "phy") return /(calc|ohm|current|voltage|resistance|power|pressure|moment|velocity|acceleration|graph)/.test(h) ? "P2" : "P1";
  if (subject === "chem") return /(titration|volumetric|practical|salt|identification|qualitative)/.test(h) ? "P3" : "Mixed";
  if (subject === "bio")  return /(experiment|practical|specimen|microscope|dissect|slide|stain)/.test(h) ? "P3" : "Mixed";
  if (subject === "geo")  return /map/.test(h) ? "P1" : "Mixed";
  return "Mixed";
}
