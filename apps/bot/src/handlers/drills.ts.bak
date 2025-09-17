// apps/bot/src/handlers/drills.ts
import { Telegraf, Markup } from "telegraf";
import { getDrill } from "../services/drill-engine";
import { getOrGenerateInsight } from "../services/insights";
import * as sessionRepo from "../repo/sessionRepo";
import { SUBJECTS } from "../subjects";
import * as drillsRepo from "../repo/drillsRepo";

const DIFF_MAP = {
  easy:   { questions: 5,  level: 0 },
  normal: { questions: 8,  level: 1 },
  medium: { questions: 8,  level: 1 }, // alias
  hard:   { questions: 10, level: 2 },
  insane: { questions: 12, level: 3 },
} as const;

type DiffKey = keyof typeof DIFF_MAP;

function pickDifficulty(tokens: string[]): { topicTokens: string[]; diff: DiffKey } {
  if (!tokens.length) return { topicTokens: tokens, diff: "normal" };
  const last = tokens[tokens.length - 1]?.toLowerCase();
  if (last && (last in DIFF_MAP)) {
    return { topicTokens: tokens.slice(0, -1), diff: last as DiffKey };
  }
  return { topicTokens: tokens, diff: "normal" };
}

/** Accept slug/label; tolerate null/undefined. Return normalized label or null. */
function subjectLabelFromSession(input?: string | null): string | null {
  if (!input) return null;
  const s = input.toLowerCase();
  const bySlug = (SUBJECTS as any[]).find(x => x?.slug?.toLowerCase?.() === s);
  if (bySlug) return bySlug.label ?? String(bySlug);
  const byLabel = (SUBJECTS as any[]).find(x => x?.label?.toLowerCase?.() === s);
  if (byLabel) return byLabel.label ?? String(byLabel);
  const byString = (SUBJECTS as any[]).find(x => String(x).toLowerCase() === s);
  return byString ? String(byString) : null;
}

/** Normalize stored difficulty to DIFF_MAP key */
function normalizeStoredDifficulty(d: string | undefined): DiffKey {
  const v = (d || "").toLowerCase();
  if (v === "easy" || v === "hard" || v === "insane") return v;
  if (v === "medium" || v === "normal") return "normal";
  return "normal";
}

export function registerDrillHandlers(bot: Telegraf) {
  // Create new drill
  bot.command("drill", async (ctx) => {
    try {
      const text = (ctx.message as any)?.text || "";
      const [, ...rest] = text.trim().split(/\s+/);

      const { topicTokens, diff } = pickDifficulty(rest);
      const topic = topicTokens.join(" ").trim();

      if (!topic) {
        return ctx.reply(
          [
            "Usage: <b>/drill &lt;topic&gt; [difficulty]</b>",
            "Examples:",
            "• /drill Algebra",
            "• /drill Quadratic equations hard",
            "Difficulties: easy | normal | hard | insane",
          ].join("\n"),
          { parse_mode: "HTML" }
        );
      }

      // Resolve subject from active session
      const tgId = String(ctx.from?.id ?? "");
      let subject = "Mathematics";
      try {
        const active = await sessionRepo.getActiveByTelegramId(tgId);
        const sesLabel = subjectLabelFromSession(active?.subjectLabel);
        if (sesLabel) subject = sesLabel;
      } catch { /* ignore */ }

      const cfg = DIFF_MAP[diff];
      const drill = await getDrill(subject, topic, cfg.questions, cfg.level);

      // Persist the served drill set
      const saved = await drillsRepo.createDrill({
        telegramId: tgId,
        subjectLabel: subject,
        topic,
        difficulty: diff === "medium" ? "medium" : (diff as any),
        questions: (drill.questions || []).map((q: any) => ({ q: String(q.q ?? q.question ?? ""), a: q.a })),
        score: 0,
        outOf: (drill.questions || []).length,
      });

      // Format drill questions
      const questions = (drill.questions || [])
        .map((q: any, i: number) => `Q${i + 1}) ${q.q}`)
        .join("\n\n");

      const body =
        `📝 <b>Drill</b>\n` +
        `Subject: <b>${subject}</b>\n` +
        `Topic: <b>${topic}</b>\n` +
        `Difficulty: <i>${diff}</i>\n` +
        `ID: <code>${(saved as any)._id}</code>\n\n` +
        (questions || "(No questions generated.)");

      await ctx.reply(body, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback("🔁 Repeat this drill", `drill_repeat:${(saved as any)._id}`)],
          ],
        },
      });

      // Examiner-style insights
      const insight = await getOrGenerateInsight(subject, topic);
      if (insight?.tips?.length) {
        const tips = insight.tips.map((t: string) => `• ${t}`).join("\n");
        await ctx.reply(`🔎 <b>Examiner Insight</b>\n${tips}`, { parse_mode: "HTML" });
      }
    } catch {
      await ctx.reply("Drill engine hiccup. Try again in a moment or use /drill <topic> normal.");
    }
  });

  // Inline callback: repeat a drill by ID
  bot.action(/^drill_repeat:([A-Fa-f0-9]{24})$/, async (ctx) => {
    try {
      const id = ctx.match?.[1];
      if (!id) return ctx.answerCbQuery("Missing drill id.");

      await ctx.answerCbQuery("Generating a fresh set…");

      const prev = await drillsRepo.getById(id);
      if (!prev) return ctx.reply("Couldn’t find that drill anymore.");

      const telegramId = String(ctx.from?.id ?? "");
      // Use stored subject/topic/difficulty; keep same question count
      const subject = String(prev.subjectLabel || "Mathematics");
      const topic = String(prev.topic || "");
      const questionsCount = Array.isArray(prev.questions) ? prev.questions.length : 8;
      const diffKey = normalizeStoredDifficulty(prev.difficulty as any);
      const level = DIFF_MAP[diffKey].level;

      const drill = await getDrill(subject, topic, questionsCount, level);

      // Persist new run
      const saved = await drillsRepo.createDrill({
        telegramId,
        subjectLabel: subject,
        topic,
        difficulty: diffKey,
        questions: (drill.questions || []).map((q: any) => ({ q: String(q.q ?? q.question ?? ""), a: q.a })),
        score: 0,
        outOf: (drill.questions || []).length,
      });

      // Render
      const questions = (drill.questions || [])
        .map((q: any, i: number) => `Q${i + 1}) ${q.q}`)
        .join("\n\n");

      const body =
        `🔁 <b>Drill Again</b>\n` +
        `Subject: <b>${subject}</b>\n` +
        `Topic: <b>${topic}</b>\n` +
        `Difficulty: <i>${diffKey}</i>\n` +
        `ID: <code>${(saved as any)._id}</code>\n\n` +
        (questions || "(No questions generated.)");

      await ctx.reply(body, {
        parse_mode: "HTML",
        reply_markup: {
  inline_keyboard: [
    [
      Markup.button.callback("🔁 Repeat this drill", `drill_repeat:${(saved as any)._id}`),
      Markup.button.callback(
        `✅ Mark 0/${saved.outOf}`,
        `drill_markprefill:${(saved as any)._id}:${saved.outOf}`
      ),
    ],
  ],
},

      });

      // Best-effort insight again
      try {
        const insight = await getOrGenerateInsight(subject, topic);
        if (insight?.tips?.length) {
          const tips = insight.tips.map((t: string) => `• ${t}`).join("\n");
          await ctx.reply(`🔎 <b>Examiner Insight</b>\n${tips}`, { parse_mode: "HTML" });
        }
      } catch { /* ignore */ }
    } catch (err: any) {
      await ctx.reply(`Couldn’t repeat: ${String(err?.message || err)}`);
    }
  });
}
