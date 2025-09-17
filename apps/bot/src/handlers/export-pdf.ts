// apps/bot/src/handlers/export-pdf.ts
import { Telegraf, Context, Markup } from "telegraf";
import { buildPdfBuffer } from "../pdf/export.js";
import { getLatestFeedbackByTelegramId } from "../repo/feedbackRepo.js";

/**
 * Sends the user's latest examiner-style report as a PDF.
 * Assumes feedbackRepo maintains a per-user "latest feedback" snapshot.
 *
 * If you also keep an in-memory cache (state/latest.ts), make sure you update it
 * at /finish time, AND also persist to feedbackRepo so this handler works after restarts.
 */
export function registerExportPdf(bot: Telegraf<Context>) {
  // Slash command: /pdf
  bot.command("pdf", async (ctx) => {
    const uid = String(ctx.from?.id ?? "");
    try {
      const fb = await getLatestFeedbackByTelegramId(uid);
      if (!fb) {
        return ctx.reply(
          "No recent session found. Start with /session, upload your answers, then /finish to generate a report."
        );
      }

      await ctx.reply("Generating your PDF…");

      // buildPdfBuffer should return Buffer | Uint8Array
      const data = await buildPdfBuffer(fb);
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);

      const filename = `BrainBot-Feedback-${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.pdf`;

      await ctx.replyWithDocument(
        { source: buf, filename },
        {
          caption: "📄 Full examiner-style report.",
          reply_markup: {
            inline_keyboard: [[Markup.button.callback("📄 Export PDF", "export_pdf")]],
          },
        }
      );
    } catch (err: any) {
      const msg = String(err?.message || err);
      await ctx.reply(`Couldn’t generate PDF: ${msg}`);
    }
  });

  // Inline button: "📄 Export PDF"
  bot.action("export_pdf", async (ctx) => {
    const uid = String(ctx.from?.id ?? "");
    try {
      // Telegraf UX nicety: acknowledge the tap quickly
      await ctx.answerCbQuery("Generating PDF…");

      const fb = await getLatestFeedbackByTelegramId(uid);
      if (!fb) {
        return ctx.answerCbQuery("No recent session. Run /session first.");
      }

      const data = await buildPdfBuffer(fb);
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);

      const filename = `BrainBot-Feedback-${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.pdf`;

      await ctx.replyWithDocument(
        { source: buf, filename },
        {
          caption: "📄 Saved — share with your teacher/parent.",
          reply_markup: {
            inline_keyboard: [[Markup.button.callback("📄 Export PDF", "export_pdf")]],
          },
        }
      );
    } catch (err: any) {
      const msg = String(err?.message || err);
      // For callback flows prefer answerCbQuery to avoid chat noise
      await ctx.answerCbQuery(`Failed: ${msg}`, { show_alert: true });
    }
  });
}
