// apps/bot/src/handlers/export-card.ts
import { Telegraf, Context, Markup } from "telegraf";
import { buildReportCardPng } from "../image/report-card.js";
import { getLatestFeedback } from "../state/latest.js";

export function registerExportCard(bot: Telegraf<Context>) {
  bot.command("card", async (ctx) => {
    const uid = String(ctx.from?.id ?? "");
    const fb = getLatestFeedback(uid);
    if (!fb) return ctx.reply("No recent session found. Do a paper first with /session.");

    await ctx.reply("Rendering your report card…");
    const png = await buildReportCardPng(fb as any);
    await ctx.replyWithPhoto({ source: Buffer.from(png) }, {
      caption: "🖼️ Share this with your classmates or teacher!",
      reply_markup: {
        inline_keyboard: [[Markup.button.callback("📄 Export PDF", "export_pdf")]],
      },
    });
  });

  bot.action("export_card", async (ctx) => {
    const uid = String(ctx.from?.id ?? "");
    const fb = getLatestFeedback(uid);
    if (!fb) return ctx.answerCbQuery("No recent session.");
    await ctx.answerCbQuery("Rendering…");
    const png = await buildReportCardPng(fb as any);

    await ctx.replyWithPhoto({ source: Buffer.from(png) }, {
      caption: "🖼️ Report card ready.",
      reply_markup: {
        inline_keyboard: [[Markup.button.callback("📄 Export PDF", "export_pdf")]],
      },
    });
  });
}
