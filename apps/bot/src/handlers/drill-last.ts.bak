// apps/bot/src/handlers/drill-last.ts
import { Telegraf } from "telegraf";
import * as drillsRepo from "../repo/drillsRepo";
import * as sessionRepo from "../repo/sessionRepo";
import { SUBJECTS } from "../subjects";

function normalizeSubjectLabel(input?: string | null): string | null {
  if (!input) return null;
  const lower = input.toLowerCase();
  const arr = SUBJECTS as any[];
  const bySlug = arr.find(s => s?.slug?.toLowerCase?.() === lower);
  if (bySlug) return bySlug.label ?? String(bySlug);
  const byLabel = arr.find(s => s?.label?.toLowerCase?.() === lower);
  if (byLabel) return byLabel.label ?? String(byLabel);
  const byString = arr.find(s => String(s).toLowerCase() === lower);
  return byString ? String(byString) : null;
}

export function registerDrillLastHandler(bot: Telegraf) {
  // Usage: /drill_last <topic>
  bot.command("drill_last", async (ctx) => {
    try {
      const text = (ctx.message as any)?.text || "";
      const [, ...rest] = text.trim().split(/\s+/);
      const topic = rest.join(" ").trim();

      if (!topic) {
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

      const latest = await drillsRepo.getLatestByTopic({
        telegramId,
        subjectLabel,
        topic,
      });

      if (!latest) {
        return ctx.reply(`No recent drill found for "${topic}" in ${subjectLabel}. Try running /drill ${topic} first.`);
      }

      const pct = Math.round((latest.score / Math.max(1, latest.outOf)) * 100);
      const qs = (latest.questions || [])
        .map((q: any, i: number) => `Q${i + 1}) ${q.q}`)
        .join("\n\n");

      await ctx.reply(
        [
          `🕘 <b>Last Drill</b>`,
          `Subject: <b>${subjectLabel}</b>`,
          `Topic: <b>${latest.topic}</b>`,
          `Difficulty: <i>${latest.difficulty}</i>`,
          `ID: <code>${(latest as any)._id}</code>`,
          `Score: ${latest.score}/${latest.outOf} (${pct}%)`,
          ``,
          qs || "(No questions stored.)",
          ``,
          `You can re-mark it: <code>/drill_mark ${(latest as any)._id} ${latest.outOf}/${latest.outOf}</code>`,
        ].join("\n"),
        { parse_mode: "HTML" }
      );
    } catch (err: any) {
      await ctx.reply(`Couldn’t fetch last drill: ${String(err?.message || err)}`);
    }
  });
}
