// apps/bot/src/handlers/insights.ts
import { Telegraf } from "telegraf";
import { getOrGenerateInsight } from "../services/insights.js";
import * as sessionRepo from "../repo/sessionRepo.js";
import { SUBJECTS } from "../subjects.js";

function normalizeSubjectLabel(input?: string | null): string | null {
  if (!input) return null;
  const s = input.toLowerCase();
  const bySlug = SUBJECTS.find(x => x.slug.toLowerCase() === s);
  if (bySlug) return bySlug.label;
  const byLabel = SUBJECTS.find(x => x.label.toLowerCase() === s);
  return byLabel ? byLabel.label : null;
}

function parseArgsToSubjectAndTopic(rawArgs: string[], sessionSubjectLabel: string | null) {
  if (rawArgs.length > 0) {
    const maybeSubject = normalizeSubjectLabel(rawArgs[0]);
    if (maybeSubject) {
      const topic = rawArgs.slice(1).join(" ").trim();
      return { subject: maybeSubject, topic: topic || "Algebra" };
    }
  }
  return {
    subject: sessionSubjectLabel || "Mathematics",
    topic: rawArgs.join(" ").trim() || "Algebra",
  };
}

export function registerInsightsHandlers(bot: Telegraf) {
  bot.command("insights", async (ctx) => {
    try {
      const text = (ctx.message as any)?.text || "";
      const [, ...rest] = text.trim().split(/\s+/);

      const tgId = String(ctx.from?.id ?? "");
      let sessionSubjectLabel: string | null = null;

      try {
        const active = await sessionRepo.getActiveByTelegramId(tgId);
        sessionSubjectLabel = normalizeSubjectLabel(active?.subjectLabel ?? null); // <-- was .subject
      } catch {
        /* ignore */
      }

      const { subject, topic } = parseArgsToSubjectAndTopic(rest, sessionSubjectLabel);

      const insight = await getOrGenerateInsight(subject, topic);
      const tips = (insight?.tips ?? [])
        .map(t => `- ${t}`)
        .join("\n") || "- Building insights… try again after your next drill.";

      await ctx.reply(
        `🧠 <b>Examiner Insight</b>\nSubject: <b>${subject}</b>\nTopic: <b>${topic}</b>\n\n${tips}`,
        { parse_mode: "HTML" }
      );
    } catch {
      await ctx.reply("Couldn’t fetch insights right now. Try again in a bit or specify a topic like /insights Algebra.");
    }
  });
}
