// apps/bot/src/handlers/drill-again.ts
import { Telegraf } from "telegraf";
import { getDrill } from "../services/drill-engine.js";
import { getOrGenerateInsight } from "../services/insights.js";
import * as sessionRepo from "../repo/sessionRepo.js";
import * as drillsRepo from "../repo/drillsRepo.js";
import { SUBJECTS } from "../subjects.js";

// NEW: syllabus resolver
import { resolveTopic } from "../lib/topic-resolver.js";

const DIFF_MAP = {
  easy:   { questions: 5,  level: 0 },
  normal: { questions: 8,  level: 1 },
  medium: { questions: 8,  level: 1 }, // alias
  hard:   { questions: 10, level: 2 },
  insane: { questions: 12, level: 3 },
} as const;
type DiffKey = keyof typeof DIFF_MAP;

function normalizeSubjectLabel(input?: string | null): string | null {
  if (!input) return null;
  const lower = input.toLowerCase();
  const arr = SUBJECTS as any[];
  const bySlug = arr.find((s) => s?.slug?.toLowerCase?.() === lower);
  if (bySlug) return bySlug.label ?? String(bySlug);
  const byLabel = arr.find((s) => s?.label?.toLowerCase?.() === lower);
  if (byLabel) return byLabel.label ?? String(byLabel);
  const byString = arr.find((s) => String(s).toLowerCase() === lower);
  return byString ? String(byString) : null;
}

/** Parse args into { topic?, diff? } where diff is a known key or undefined */
function parseArgs(tokens: string[]): { topic?: string; diff?: DiffKey } {
  if (!tokens.length) return {};
  const last = tokens[tokens.length - 1]?.toLowerCase();
  if (last && (last in DIFF_MAP)) {
    return { topic: tokens.slice(0, -1).join(" ").trim() || undefined, diff: last as DiffKey };
  }
  return { topic: tokens.join(" ").trim() || undefined, diff: undefined };
}

/** Convert stored difficulty string to a DIFF_MAP key */
function normalizeStoredDifficulty(d: string | undefined): DiffKey {
  const v = (d || "").toLowerCase();
  if (v === "easy" || v === "hard" || v === "insane") return v;
  if (v === "medium" || v === "normal") return "normal";
  return "normal";
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (ch) =>
    ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&quot;"
  );
}

export function registerDrillAgainHandler(bot: Telegraf) {
  // /drill_again [<topic>] [difficulty]
  bot.command("drill_again", async (ctx) => {
    try {
      const text = (ctx.message as any)?.text || "";
      const [, ...rest] = text.trim().split(/\s+/);
      const { topic: topicArg, diff: diffOverride } = parseArgs(rest);

      const telegramId = String(ctx.from?.id ?? "");

      // Resolve subject from active session
      let subject = "Mathematics";
      try {
        const active = await sessionRepo.getActiveByTelegramId(telegramId);
        subject = normalizeSubjectLabel(active?.subjectLabel ?? null) || subject;
      } catch { /* ignore */ }

      // If topic omitted, pull latest drill for this subject; else prefer latest for that topic.
      const latestForTopic = await drillsRepo.getLatestByTopic({
        telegramId,
        subjectLabel: subject,
        topic: topicArg || "",
      });

      let topic = topicArg;
      let baselineQuestions = latestForTopic?.questions?.length || 0;
      let baselineDiff: DiffKey | undefined = latestForTopic
        ? normalizeStoredDifficulty(latestForTopic.difficulty as any)
        : undefined;

      if (!topic || baselineQuestions === 0) {
        const recent = await drillsRepo.listRecent({ telegramId, subjectLabel: subject, limit: 1 });
        if (recent?.length) {
          const last = recent[0];
          if (!topic) topic = last.topic;
          if (!baselineQuestions) baselineQuestions = Array.isArray(last.questions) ? last.questions.length : 0;
          if (!baselineDiff) baselineDiff = normalizeStoredDifficulty(last.difficulty as any);
        }
      }

      if (!topic) {
        return ctx.reply(
          [
            "Usage: <code>/drill_again &lt;topic&gt; [difficulty]</code>",
            "Examples:",
            "• <code>/drill_again Algebra</code>",
            "• <code>/drill_again Algebra hard</code>",
            "",
            "Tip: If you omit the topic, I’ll try to re-run your last drill from this subject.",
          ].join("\n"),
          { parse_mode: "HTML" }
        );
      }

      // 🔎 Canonicalize the topic via syllabus (works even if syllabus is empty)
      const { canonical, suggestion } = resolveTopic(subject, topic);
      if (!canonical) {
        return ctx.replyWithHTML(
          suggestion
            ? `Topic not found. Did you mean <b>${escapeHtml(suggestion)}</b>?\n` +
              `Try: <code>/drill_again ${escapeHtml(suggestion)}</code>`
            : `Topic not in the syllabus for <b>${escapeHtml(subject)}</b>. ` +
              `Try another topic or check spelling.`
        );
      }
      const chosenTopic = canonical;

      const difficulty: DiffKey = diffOverride || baselineDiff || "normal";
      const cfg = DIFF_MAP[difficulty];

      // Decide question count: override wins → else baseline → else difficulty default
      const questionCount =
        diffOverride ? cfg.questions :
        baselineQuestions > 0 ? baselineQuestions :
        cfg.questions;

      // Engine "level" comes from difficulty mapping, not baseline count
      const level = cfg.level;

      // Generate a fresh set with same shape (topic + Q count), new numbers
      const drill = await getDrill(subject, chosenTopic, questionCount, level);

      // Persist the newly served drill
      const saved = await drillsRepo.createDrill({
        telegramId,
        subjectLabel: subject,
        topic: chosenTopic,
        difficulty: difficulty === "medium" ? "medium" : (difficulty as any),
        questions: (drill.questions || []).map((q: any) => ({ q: String(q.q ?? q.question ?? ""), a: q.a })),
        score: 0,
        outOf: (drill.questions || []).length,
      });

      // Render Qs
      const questions = (drill.questions || [])
        .map((q: any, i: number) => `Q${i + 1}) ${q.q}`)
        .join("\n\n");

      await ctx.reply(
        [
          `🔁 <b>Drill Again</b>`,
          `Subject: <b>${escapeHtml(subject)}</b>`,
          `Topic: <b>${escapeHtml(chosenTopic)}</b>`,
          `Difficulty: <i>${escapeHtml(difficulty)}</i>`,
          `ID: <code>${(saved as any)._id}</code>`,
          ``,
          questions || "(No questions generated.)",
        ].join("\n"),
        { parse_mode: "HTML" }
      );

      // Optional best-effort insights
      try {
        const insight = await getOrGenerateInsight(subject, chosenTopic);
        if (insight?.tips?.length) {
          const tips = insight.tips.map((t: string) => `• ${t}`).join("\n");
          await ctx.reply(`🔎 <b>Examiner Insight</b>\n${tips}`, { parse_mode: "HTML" });
        }
      } catch { /* ignore */ }
    } catch (err: any) {
      await ctx.reply(`Couldn’t re-run that drill: ${String(err?.message || err)}`);
    }
  });
}
