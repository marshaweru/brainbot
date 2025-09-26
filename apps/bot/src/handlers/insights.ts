import type { Context } from "telegraf";
import { Telegraf } from "telegraf";
import { getOrGenerateInsight } from "../services/insights.js";
import { llm } from "../lib/llm.js";

/** /insights <subject> | <topic> | [level] */
function parseArgs(text: string) {
  const after = text.replace(/^\/insights(@\w+)?\s*/i, "");
  const parts = after.split("|").map(s => s.trim()).filter(Boolean);
  return {
    subject: parts[0] || "Mathematics",
    topic: parts[1] || "Quadratic Equations",
    level: parts[2] || "KCSE",
  };
}

export function registerInsights(bot: Telegraf) {
  bot.command("insights", async (ctx: Context) => {
    try {
      const text = (ctx.message as any)?.text ?? "";
      const { subject, topic, level } = parseArgs(text);
      const out = await getOrGenerateInsight(subject, topic, { llm, level });
      const body = ["🧠 Examiner Insights",
        `Subject: ${subject}`,
        `Topic: ${topic}`,
        "",
        ...out.tips.map(t => `• ${t}`)
      ].join("\n");
      await ctx.reply(body);
    } catch (e: any) {
      await ctx.reply(`Couldn’t generate insights: ${e?.message ?? "unknown error"}`);
    }
  });
}
