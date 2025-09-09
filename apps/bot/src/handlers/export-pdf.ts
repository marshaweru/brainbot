// apps/bot/src/handlers/export-pdf.ts
import { Telegraf, Context, Markup } from "telegraf";
import { buildPdfBuffer } from "../pdf/export";
import { getLatestFeedbackByTelegramId } from "../repo/feedbackRepo";

export function registerExportPdf(bot: Telegraf<Context>) {
  // /pdf => send latest session PDF
  bot.command("pdf", async (ctx) => {
    const uid = String(ctx.from?.id ?? "");
    const fb = await getLatestFeedbackByTelegramId(uid);
    if (!fb) return ctx.reply("No recent session found. Start with /session.");

    await ctx.reply("Generating your PDF…");
    const pdf = await buildPdfBuffer(fb);
    await ctx.replyWithDocument(
      { source: Buffer.from(pdf), filename: "BrainBot-Feedback.pdf" },
      {
        caption: "📄 Full examiner-style report.",
        reply_markup: {
          inline_keyboard: [[
            Markup.button.callback("📄 Export PDF", "export_pdf")
          ]],
        },
      }
    );
  });

  // Inline “Export PDF” button callback
  bot.action("export_pdf", async (ctx) => {
    const uid = String(ctx.from?.id ?? "");
    const fb = await getLatestFeedbackByTelegramId(uid);
    if (!fb) return ctx.answerCbQuery("No recent session.");
    await ctx.answerCbQuery("Generating PDF…");
    const pdf = await buildPdfBuffer(fb);
    await ctx.replyWithDocument(
      { source: Buffer.from(pdf), filename: "BrainBot-Feedback.pdf" },
      {
        caption: "📄 Saved — share with your teacher/parent.",
        reply_markup: {
          inline_keyboard: [[
            Markup.button.callback("📄 Export PDF", "export_pdf")
          ]],
        },
      }
    );
  });
}
