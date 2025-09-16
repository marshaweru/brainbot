// apps/bot/src/handlers/drill-mark.ts
import { Telegraf } from "telegraf";
import * as drillsRepo from "../repo/drillsRepo";

export function registerDrillMarkHandler(bot: Telegraf) {
  // Usage: /drill_mark 66fcd1e6e5b4a8a9dfc1b234 7/10
  bot.command("drill_mark", async (ctx) => {
    try {
      const text = (ctx.message as any)?.text || "";
      const [, id, scorePart] = text.trim().split(/\s+/);

      if (!id || !scorePart || !/^\d+\s*\/\s*\d+$/.test(scorePart)) {
        return ctx.reply(
          [
            "Usage: <code>/drill_mark &lt;drillId&gt; &lt;score&gt;/&lt;outOf&gt;</code>",
            "Example: <code>/drill_mark 66fcd1e6e5b4a8a9dfc1b234 7/10</code>",
          ].join("\n"),
          { parse_mode: "HTML" }
        );
      }

      const [scoreStr, outStr] = scorePart.split("/");
      const score = Number(scoreStr);
      const outOf = Number(outStr);

      if (!Number.isFinite(score) || !Number.isFinite(outOf) || outOf <= 0 || score < 0 || score > outOf) {
        return ctx.reply("Score must be like 7/10 where 0 ≤ 7 ≤ 10.");
      }

      const updated = await drillsRepo.updateScore(id, score, outOf);
      if (!updated) return ctx.reply("Drill not found. Double-check the ID from the drill message.");

      const pct = Math.round((updated.score / Math.max(1, updated.outOf)) * 100);
      await ctx.reply(
        [
          "✅ Drill marked.",
          `• Topic: ${updated.topic}`,
          `• Subject: ${updated.subjectLabel}`,
          `• Score: ${updated.score}/${updated.outOf} (${pct}%)`,
        ].join("\n")
      );
    } catch (err: any) {
      await ctx.reply(`Couldn’t mark drill: ${String(err?.message || err)}`);
    }
  });
}
