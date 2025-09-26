// apps/bot/src/handlers/drill-last.ts
import { Telegraf } from "telegraf";
import * as drillsRepo from "../repo/drillsRepo.js";
import * as sessionRepo from "../repo/sessionRepo.js";
import { SUBJECTS } from "../subjects.js";
// NEW: syllabus resolver
import { resolveTopic } from "../lib/topic-resolver.js";

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

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (ch) =>
    ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&quot;"
  );
}

export function registerDrillLastHandler(bot: Telegraf) {
  // Usage: /drill_last <topic>
  bot.command("drill_last", async (ctx) => {
    try {
      const text = (ctx.message as any)?.text || "";
      const [, ...rest] = text.trim().split(/\s+/);
      const rawTopic = rest.join(" ").trim();

      if (!rawTopic) {
        return ctx.reply(
          [
            "Usage: <code>/drill_last &lt;topic&gt;</code>",
            "Example: <code>/drill_last Algebra</code>",
            "Tip: Start a session with <code>/session</code> so I auto-target your subject.",
          ].join("\n"),
          { parse_mode: "HTML" }
        );
      }

      const telegramId = String(ctx.from?.id ?? "");
      let subjectLabel: string | null = null;
      try {
        const active = await sessionRepo.getActiveByTelegramId(telegramId);
        subjectLabel = normalizeSubjectLabel(active?.subjectLabel ?? null);
      } catch { /* ignore */ }

      if (!subjectLabel) {
        return ctx.reply(
          "I couldn't infer your subject. Start a session with /session first, then try /drill_last <topic>."
        );
      }

      // 🔎 Canonicalize via syllabus (works even if syllabus is empty)
      const { canonical, suggestion } = resolveTopic(subjectLabel, rawTopic);
      if (!canonical) {
        return ctx.replyWithHTML(
          suggestion
            ? `Topic not found. Did you mean <b>${escapeHtml(suggestion)}</b>?\n` +
              `Try: <code>/drill_last ${escapeHtml(suggestion)}</code>`
            : `Topic not in the syllabus for <b>${escapeHtml(subjectLabel)}</b>. ` +
              `Try another topic or check spelling.`
        );
      }
      const topic = canonical;

      const latest = await drillsRepo.getLatestByTopic({
        telegramId,
        subjectLabel,
        topic,
      });

      if (!latest) {
        return ctx.reply(
          `No recent drill found for "${topic}" in ${subjectLabel}. Try running /drill ${topic} first.`
        );
      }

      const outOf = typeof latest.outOf === "number"
        ? latest.outOf
        : (Array.isArray(latest.questions) ? latest.questions.length : 0);

      const score = typeof latest.score === "number" ? latest.score : 0;
      const pct = outOf ? Math.round((score / outOf) * 100) : 0;

      const qs = (latest.questions || [])
        .map((q: any, i: number) => `Q${i + 1}) ${q.q}`)
        .join("\n\n");

      await ctx.reply(
        [
          `🕘 <b>Last Drill</b>`,
          `Subject: <b>${escapeHtml(subjectLabel)}</b>`,
          `Topic: <b>${escapeHtml(latest.topic)}</b>`,
          `Difficulty: <i>${escapeHtml(String((latest as any).difficulty || "normal"))}</i>`,
          `ID: <code>${escapeHtml(String((latest as any)._id))}</code>`,
          `Score: ${score}/${outOf} (${pct}%)`,
          ``,
          qs || "(No questions stored.)",
          ``,
          `You can re-run it: <code>/drill_again ${escapeHtml(latest.topic)}</code>`,
        ].join("\n"),
        { parse_mode: "HTML" }
      );
    } catch (err: any) {
      await ctx.reply(`Couldn’t fetch last drill: ${String(err?.message || err)}`);
    }
  });
}
