// apps/bot/src/handlers/drills.ts
import type { Context } from "telegraf";
import { Telegraf, Markup } from "telegraf";
import { getDrill } from "../services/drill-engine.js";
import { getOrGenerateInsight } from "../services/insights.js";
import * as sessionRepo from "../repo/sessionRepo.js";
import { SUBJECTS } from "../subjects.js";
import * as drillsRepo from "../repo/drillsRepo.js";
import { startDrillLog, touchDrillLog, finishDrillLog } from "../repo/drillLogRepo.js";

/** Difficulty presets */
const DIFF_MAP = {
  easy:   { questions: 5,  level: 0 },
  normal: { questions: 8,  level: 1 },
  medium: { questions: 8,  level: 1 }, // alias → normalized to "normal"
  hard:   { questions: 10, level: 2 },
  insane: { questions: 12, level: 3 },
} as const;

type DiffKey = keyof typeof DIFF_MAP;
type StoredDiff = Exclude<DiffKey, "medium">;

function normalizeDifficulty(d: DiffKey | string | undefined): StoredDiff {
  const v = String(d || "").toLowerCase();
  if (v === "easy" || v === "hard" || v === "insane") return v;
  return "normal";
}
function pickDifficulty(tokens: string[]): { topicTokens: string[]; diffKey: DiffKey } {
  if (!tokens.length) return { topicTokens: tokens, diffKey: "normal" };
  const last = (tokens[tokens.length - 1] || "").toLowerCase() as DiffKey;
  if (last in DIFF_MAP) return { topicTokens: tokens.slice(0, -1), diffKey: last };
  return { topicTokens: tokens, diffKey: "normal" };
}

/** Subject detection from active session */
function subjectLabelFromSession(input?: string | null): string | null {
  if (!input) return null;
  const s = input.toLowerCase();
  const list = Array.isArray(SUBJECTS) ? (SUBJECTS as any[]) : [];
  const bySlug = list.find((x) => x?.slug?.toLowerCase?.() === s);
  if (bySlug) return bySlug.label ?? String(bySlug);
  const byLabel = list.find((x) => x?.label?.toLowerCase?.() === s);
  if (byLabel) return byLabel.label ?? String(byLabel);
  const byString = list.find((x) => String(x).toLowerCase() === s);
  return byString ? String(byString) : null;
}

/** Telegram long-message safety */
async function replyLong(ctx: Context, html: string) {
  const MAX = 4000;
  if (html.length <= MAX) return ctx.reply(html, { parse_mode: "HTML" });
  for (let i = 0; i < html.length; i += MAX) {
    // eslint-disable-next-line no-await-in-loop
    await ctx.reply(html.slice(i, i + MAX), { parse_mode: "HTML" });
  }
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (ch) =>
    ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&quot;"
  );
}
function renderDrillBody(
  kindTitle: string,
  subject: string,
  topic: string,
  diffKey: StoredDiff | DiffKey,
  id: string,
  questions: Array<{ q: string }>
) {
  const normalized = normalizeDifficulty(String(diffKey));
  const qText = questions?.length
    ? questions.map((q, i) => `Q${i + 1}) ${q.q}`).join("\n\n")
    : "(No questions generated.)";
  return (
    `${kindTitle}\n` +
    `Subject: <b>${escapeHtml(subject)}</b>\n` +
    `Topic: <b>${escapeHtml(topic)}</b>\n` +
    `Difficulty: <i>${escapeHtml(normalized)}</i>\n` +
    `ID: <code>${id}</code>\n\n` +
    qText
  );
}

/** Shared entry for deep-links and /drill */
export async function startDrill(ctx: Context, rawTopic: string, rawDiff?: string) {
  const tokens = rawTopic.split(/\s+/).filter(Boolean);
  const { topicTokens, diffKey } = pickDifficulty(rawDiff ? [...tokens, rawDiff] : tokens);
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

  const tgId = String(ctx.from?.id ?? "");
  let subject = "Mathematics";
  try {
    const active = await sessionRepo.getActiveByTelegramId(tgId);
    const sesLabel = subjectLabelFromSession(active?.subjectLabel);
    if (sesLabel) subject = sesLabel;
  } catch { /* ignore */ }

  const chosenStored = normalizeDifficulty(diffKey);
  const cfg = DIFF_MAP[chosenStored];

  const drill = await getDrill(subject, topic, cfg.questions, cfg.level);
  const qs = (drill?.questions || []).map((q: any) => ({
    q: String(q?.q ?? q?.question ?? "").trim(),
    a: q?.a,
  }));

  const saved = await drillsRepo.createDrill({
    telegramId: tgId,
    subjectLabel: subject,
    topic,
    difficulty: chosenStored,
    questions: qs,
    score: 0,
    outOf: qs.length,
  });

  // Analytics (non-blocking)
  let drillLogId: string | null = null;
  try {
    drillLogId = String(
      await startDrillLog({
        telegramId: tgId,
        subjectLabel: subject,
        topic,
        difficulty: chosenStored,
        outOf: qs.length,
      })
    );
  } catch {}

  const body = renderDrillBody("📝 <b>Drill</b>", subject, topic, chosenStored, String((saved as any)?._id), qs);
  await ctx.reply(body, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          Markup.button.callback("🔁 Repeat this drill", `drill_repeat:${(saved as any)._id}`),
          Markup.button.callback(`✅ Mark 0/${qs.length}`, `drill_markprefill:${(saved as any)._id}:${qs.length}`),
        ],
      ],
    },
  });

  try {
    const insight = await getOrGenerateInsight(subject, topic);
    if (insight?.tips?.length) {
      const tips = insight.tips.map((t: string) => `• ${t}`).join("\n");
      await replyLong(ctx, `🔎 <b>Examiner Insight</b>\n${tips}`);
    }
  } catch {}

  if (drillLogId) touchDrillLog(drillLogId).catch(() => {});
}

/** Register all flows */
export function registerDrillHandlers(bot: Telegraf<Context>) {
  // /drill <topic> [difficulty]
  bot.command("drill", async (ctx) => {
    try {
      const text = (ctx.message as any)?.text || "";
      const [, ...rest] = text.trim().split(/\s+/);
      if (!rest.length) {
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
      const { topicTokens, diffKey } = pickDifficulty(rest);
      const topic = topicTokens.join(" ").trim();
      await startDrill(ctx, topic, diffKey);
    } catch (err: any) {
      await ctx.reply(`Drill engine hiccup. ${String(err?.message || "Try again shortly.")}`);
    }
  });

  // Repeat a drill by ID
  bot.action(/^drill_repeat:([A-Fa-f0-9]{24})$/, async (ctx) => {
    try {
      const id = ctx.match?.[1];
      if (!id) return ctx.answerCbQuery("Missing drill id.");
      await ctx.answerCbQuery("Generating a fresh set…");

      const prev = await drillsRepo.getById(id);
      if (!prev) return ctx.reply("Couldn’t find that drill anymore.");

      const telegramId = String(ctx.from?.id ?? "");
      const subject = String(prev.subjectLabel || "Mathematics");
      const topic = String(prev.topic || "");
      const prevCount = Array.isArray(prev.questions) ? prev.questions.length : 8;
      const diff = normalizeDifficulty((prev as any).difficulty);

      const drill = await getDrill(subject, topic, prevCount, DIFF_MAP[diff].level);
      const qs = (drill?.questions || []).map((q: any) => ({
        q: String(q?.q ?? q?.question ?? "").trim(),
        a: q?.a,
      }));

      const saved = await drillsRepo.createDrill({
        telegramId,
        subjectLabel: subject,
        topic,
        difficulty: diff,
        questions: qs,
        score: 0,
        outOf: qs.length,
      });

      const body = renderDrillBody("🔁 <b>Drill Again</b>", subject, topic, diff, String((saved as any)?._id), qs);
      await ctx.reply(body, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              Markup.button.callback("🔁 Repeat this drill", `drill_repeat:${(saved as any)._id}`),
              Markup.button.callback(`✅ Mark 0/${qs.length}`, `drill_markprefill:${(saved as any)._id}:${qs.length}`),
            ],
          ],
        },
      });

      touchDrillLog(String(saved?._id)).catch(() => {});
    } catch (err: any) {
      await ctx.reply(`Couldn’t repeat: ${String(err?.message || err)}`);
    }
  });

  // Prefill marking template
  bot.action(/^drill_markprefill:([A-Fa-f0-9]{24}):(\d{1,3})$/, async (ctx) => {
    try {
      const id = ctx.match?.[1];
      const outOf = Math.max(0, Math.min(200, parseInt(ctx.match?.[2] || "0", 10)));
      if (!id || !outOf) return ctx.answerCbQuery("Missing drill id or outOf.");

      await ctx.answerCbQuery("Marking template sent.");
      const template = Array.from({ length: outOf }, (_, i) => (i % 2 === 0 ? "1" : "0")).join(",");

      await ctx.reply(
        [
          "🧮 <b>Quick Mark</b>",
          `Reply like this once you’ve checked your answers:`,
          "",
          `<code>/mark ${id} ${template}</code>`,
          "",
          "Use 1 for correct, 0 for wrong. Example above is just a template—edit it.",
        ].join("\n"),
        { parse_mode: "HTML" }
      );
    } catch (err: any) {
      await ctx.reply(`Couldn’t prepare mark template: ${String(err?.message || err)}`);
    }
  });

  // /mark <drillId> 1,0,1,1,0
  bot.command("mark", async (ctx) => {
    try {
      const text = (ctx.message as any)?.text || "";
      const parts = text.trim().split(/\s+/);
      if (parts.length < 3) {
        return ctx.reply(
          ["Usage:", "<code>/mark &lt;drillId&gt; 1,0,1,1,0</code>", "→ 1 = correct, 0 = wrong (commas only)."].join(
            "\n"
          ),
          { parse_mode: "HTML" }
        );
      }

      const drillId = parts[1];
      const csv = parts.slice(2).join(" ").replace(/\s+/g, "");
      if (!/^[01](,[01])*$/.test(csv)) {
        return ctx.reply("Invalid answers. Use only 0/1 separated by commas, e.g. 1,0,1,1,0");
      }

      const answers = csv.split(",").map((x) => Number(x));
      const drill = await drillsRepo.getById(drillId);
      if (!drill) return ctx.reply("Drill not found. Generate a new one with /drill.");

      const outOf = Array.isArray(drill.questions) ? drill.questions.length : drill.outOf || answers.length;
      if (answers.length !== outOf) {
        return ctx.reply(`Expected ${outOf} answers, got ${answers.length}. Edit and resend.`);
      }

      const score = answers.reduce((sum, x) => sum + (x === 1 ? 1 : 0), 0);
      await drillsRepo.updateScore(drillId, score, outOf);
      try { await finishDrillLog(drillId, score); } catch {}

      const percent = outOf ? Math.round((score / outOf) * 100) : 0;
      await ctx.reply(
        [
          "✅ <b>Marked</b>",
          `Score: <b>${score}/${outOf}</b> (${percent}%)`,
          "Want another round? Tap Repeat above or try <code>/drill</code> with a new topic.",
        ].join("\n"),
        { parse_mode: "HTML" }
      );
    } catch (err: any) {
      await ctx.reply(`Couldn’t mark: ${String(err?.message || err)}`);
    }
  });

  // /recent [n] — last n drills (default 5, max 20)
  bot.command("recent", async (ctx) => {
    try {
      const text = (ctx.message as any)?.text || "";
      const [, nRaw] = text.trim().split(/\s+/);
      const limit = clamp(parseInt(nRaw || "5", 10), 1, 20);

      const telegramId = String(ctx.from?.id ?? "");
      const items = await drillsRepo.listRecent({ telegramId, limit });

      if (!items.length) {
        return ctx.reply("No recent drills yet. Try /drill Algebra or tap a drill button from the web.");
      }

      const lines = items.map((d, i) => {
        const diff = normalizeDifficulty((d as any).difficulty);
        const score = typeof d.score === "number" ? d.score : 0;
        const outOf = typeof d.outOf === "number" ? d.outOf : (Array.isArray(d.questions) ? d.questions.length : 0);
        const when = timeAgo(d.createdAt as any);
        return [
          `<b>${i + 1}.</b> <code>${String((d as any)._id)}</code>`,
          `• ${escapeHtml(d.subjectLabel)} — ${escapeHtml(d.topic)} (${diff})`,
          `• Score: ${score}/${outOf} • ${when}`,
        ].join("\n");
      });

      await replyLong(ctx, `🗂️ <b>Recent Drills</b>\n\n${lines.join("\n\n")}`);
    } catch (err: any) {
      await ctx.reply(`Couldn’t fetch recent: ${String(err?.message || err)}`);
    }
  });
}

/** Utils */
function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
function timeAgo(dateLike: string | number | Date | undefined) {
  const d = dateLike ? new Date(dateLike) : new Date();
  const diff = Math.max(0, Date.now() - d.getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
