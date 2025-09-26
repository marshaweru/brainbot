// apps/bot/src/handlers/feedback.ts
import type { Context } from "telegraf";
import { Telegraf } from "telegraf";
import mongoose from "mongoose";
import { SessionModel } from "../models/Session.js";
import { renderFeedback } from "../utils/render-feedback.js";
import { getOrGenerateInsight } from "../services/insights.js";
import { monoGrid } from "../utils/grid.js";

/** Try to coerce a string into ObjectId; return null if invalid */
function toObjectId(s: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(s);
  } catch {
    return null;
  }
}

/** Compute seconds between two dates, safe */
function secsBetween(a?: Date | string | null, b?: Date | string | null): number | undefined {
  if (!a || !b) return undefined;
  const t1 = new Date(a).getTime();
  const t2 = new Date(b).getTime();
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return undefined;
  const d = Math.max(0, Math.round((t2 - t1) / 1000));
  return d || undefined;
}

/** Extracts reasonable fields from your Session doc, with fallbacks */
function shapeFeedbackFromSession(doc: any) {
  const subject =
    doc?.subjectLabel ||
    doc?.subject ||
    doc?.meta?.subject ||
    "General Studies";

  const topic =
    (Array.isArray(doc?.topics) && doc.topics[0]) ||
    doc?.topic ||
    doc?.meta?.topic ||
    null;

  // Marks
  const awarded =
    Number(
      doc?.marksAwarded ??
        doc?.score ??
        doc?.result?.awarded ??
        doc?.metrics?.marksAwarded
    ) || 0;

  const total =
    Number(
      doc?.marksTotal ??
        doc?.maxScore ??
        doc?.result?.total ??
        doc?.metrics?.marksTotal
    ) || Math.max(awarded, 10);

  // Timing (prefer explicit duration, else compute)
  const timeSpentSec: number | undefined =
    Number(doc?.timeSpentSec ?? doc?.durationSec) ||
    secsBetween(doc?.startedAt ?? doc?.createdAt, doc?.finishedAt ?? doc?.updatedAt);

  // Ideal time heuristic: ~90 sec per mark
  const idealTimeSec = Number.isFinite(total) ? Math.round(total * 90) : undefined;

  const strengths = (doc?.strengths ?? [])
    .slice(0, 6)
    .map((s: any) => ({ area: String(s?.area ?? s ?? ""), evidence: s?.evidence && String(s.evidence) }))
    .filter((x: any) => x.area);

  const weaknesses = (doc?.weaknesses ?? [])
    .slice(0, 6)
    .map((w: any) => ({
      area: String(w?.area ?? w ?? ""),
      fix: w?.fix && String(w.fix),
      evidence: w?.evidence && String(w.evidence),
    }))
    .filter((x: any) => x.area);

  const misconceptions = (doc?.misconceptions ?? [])
    .slice(0, 5)
    .map((m: any) => ({ topic: String(m?.topic ?? topic ?? "Topic"), note: String(m?.note ?? m ?? "") }))
    .filter((x: any) => x.note);

  const drills =
    (doc?.weakTopics ?? [])
      .slice(0, 3)
      .map((t: any) => ({ topic: String(t?.topic ?? t ?? ""), count: 3, difficulty: "normal" }))
      .filter((x: any) => x.topic) || [];

  return {
    subject,
    topic,
    marksAwarded: awarded,
    marksTotal: total,
    timeSpentSec,
    idealTimeSec,
    strengths,
    weaknesses,
    misconceptions,
    drills,
  };
}

/** Pull a normalized per-topic array from whatever the session stores. */
function extractTopicStats(session: any): Array<{ topic: string; score: string; time: string }> {
  // Try a few common shapes you might have in your doc:
  const raw =
    session?.topicStats ||
    session?.metrics?.byTopic ||
    session?.metrics?.topics ||
    session?.perTopic ||
    [];

  const arr: any[] = Array.isArray(raw) ? raw : [];

  // Normalize into { topic, score "x/y", time "Xm" }
  const norm = (r: any) => {
    const t = String(r?.topic ?? r?.name ?? r?.label ?? "").trim();
    const a = Number(r?.awarded ?? r?.score ?? r?.correct ?? r?.marksAwarded ?? 0);
    const y =
      Number(r?.total ?? r?.outOf ?? r?.marksTotal) ??
      (Number.isFinite(a) ? Math.max(a, 1) : 1);
    const s = `${a}/${y}`;
    const sec = Number(r?.timeSec ?? r?.seconds ?? r?.time);
    const time = Number.isFinite(sec) && sec > 0 ? `${Math.round(sec / 60)}m` : "";
    return t ? { topic: t, score: s, time } : null;
  };

  const out = arr.map(norm).filter(Boolean) as Array<{ topic: string; score: string; time: string }>;

  // Keep it compact — top 10 rows
  return out.slice(0, 10);
}

/**
 * /feedback <sessionId>
 * - Tries _id first; if not ObjectId, falls back to { sessionId: <text> }.
 * - Renders clean Telegram HTML via renderFeedback().
 * - Sends a second message with a mono grid if topic stats exist.
 */
export function registerFeedback(bot: Telegraf) {
  bot.command("feedback", async (ctx: Context) => {
    try {
      const text: string = (ctx.message as any)?.text ?? "";
      const arg = text.replace(/^\/feedback(@\w+)?\s*/i, "").trim();

      if (!arg) {
        await ctx.reply(
          "Usage: /feedback <sessionId>\nExample: /feedback 665f8b5b2f7e0f0012a9cabc"
        );
        return;
      }

      const oid = toObjectId(arg);
      const query = oid ? { _id: oid } : ({ sessionId: arg } as any);
      const session = await SessionModel.findOne(query).lean().exec();

      if (!session) {
        await ctx.reply("Couldn’t find a session with that ID.");
        return;
      }

      const base = shapeFeedbackFromSession(session);

      // Examiner tips (soft-fail)
      let tips: string[] = [];
      try {
        const insight = await getOrGenerateInsight(base.subject, base.topic ?? "General");
        tips = Array.isArray(insight?.tips) ? insight.tips : [];
      } catch { /* ignore */ }

      // Safe-read optional session.resources without fighting Mongoose types
      const resourcesRaw = (session as any)?.resources;
      const resources = Array.isArray(resourcesRaw)
        ? resourcesRaw.slice(0, 3).map((r: any) => ({
            label: String(r?.label ?? "Resource"),
            url: String(r?.url ?? ""),
          })).filter((r: any) => r.url)
        : [];

      const message = renderFeedback({
        ...base,
        tips,
        resources,
      });

      // 1) Main feedback message
      await ctx.replyWithHTML(
        message,
        { link_preview_options: { is_disabled: true } } as any
      );

      // 2) Optional per-topic grid
      const stats = extractTopicStats(session);
      if (stats.length) {
        const headers = ["Topic", "Score", "Time"];
        const rows = stats.map(s => [s.topic, s.score, s.time]);
        const grid = monoGrid(headers, rows, { title: "📊 Per-topic breakdown", alignRight: [1, 2] });
        await ctx.replyWithHTML(grid, { link_preview_options: { is_disabled: true } } as any);
      }
    } catch (err: any) {
      await ctx.reply(`Couldn’t render feedback: ${err?.message ?? "unknown error"}`);
    }
  });
}
