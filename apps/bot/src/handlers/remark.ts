// apps/bot/src/handlers/remark.ts
import { Telegraf, Context } from "telegraf";
import { markSessionAndSummarize } from "../repo/markingRepo.js";
import { savePerformance } from "../repo/performanceRepo.js";
import { buildFeedbackMessage } from "../feedback/render.js";
import { compileNotesForWeakTopics } from "../services/notes-service.js";
import { SessionModel } from "../models/Session.js";
import { fetchPdfBuffer } from "../pdf/export.js"; // uses WEB_PDF_ENDPOINT + SERVICE_TOKEN
import { offerExportPdf } from "../services/pdf-export.js"; // keep as fallback

/**
 * /remark <sessionId>
 *
 * Re-runs marking + feedback for a past session, replies with text,
 * then tries to fetch a branded PDF from the web app and DM it.
 */
export function registerRemark(bot: Telegraf) {
  bot.command("remark", async (ctx: Context) => {
    const text = (ctx.message as any)?.text || "";
    const parts = text.split(/\s+/).filter(Boolean);
    const sessionId = parts[1];

    if (!sessionId) {
      return ctx.reply("Usage: /remark <sessionId>");
    }

    try {
      // 1) Load the session
      const session = await SessionModel.findById(sessionId).lean();
      if (!session) {
        return ctx.reply(`No session found with ID ${sessionId}`);
      }

      // 2) Re-run marking
      const { raw, feedback } = await markSessionAndSummarize({
        sessionId,
        subjectLabel: session.subjectLabel || "Mathematics",
      });

      // 3) Send feedback text
      const html = buildFeedbackMessage(feedback);
      await ctx.reply(html, { parse_mode: "HTML" });

      // 4) Persist performance snapshot
      const total = Number(feedback?.totalScore ?? 0);
      const outOf = Number(feedback?.outOf ?? 100) || 100;
      const gradeNumeric = Math.round((total / outOf) * 100);
      const gradeText = String(feedback?.grade ?? "");

      const weakTopics: string[] = Array.isArray(feedback?.weakTopics)
        ? feedback.weakTopics.map((w: any) => String(w?.topic ?? "")).filter(Boolean)
        : [];

      await savePerformance({
        telegramId: session.telegramId,
        subjectLabel: session.subjectLabel || "Mathematics",
        gradeNumeric,
        gradeText,
        weakTopics,
        feedback,
        raw,
      });

      // 5) Try to build + send PDF immediately (via web endpoint)
      try {
        const suffix = sessionId?.slice(-6) || "report";
        const baseName =
          (session.subjectLabel?.toLowerCase().replace(/\s+/g, "-") || "brainbot") +
          "-" +
          suffix;

        const pdfBuffer = await fetchPdfBuffer(feedback, {
          downloadName: baseName,
          watermark: "BrainBot Africa",
        });

        await ctx.replyWithDocument({
          source: pdfBuffer,
          filename: `${baseName}.pdf`,
        });
      } catch (pdfErr: any) {
        // Soft fail + offer inline export button as fallback
        await ctx.reply(
          `⚠️ PDF export didn’t auto-generate (${pdfErr?.message || pdfErr}).`
        );
        try {
          await offerExportPdf(ctx);
        } catch {
          /* ignore */
        }
      }

      // 6) Suggest notes/drills
      if (weakTopics.length) {
        const first = weakTopics[0];
        try {
          await compileNotesForWeakTopics(
            weakTopics.slice(0, 2),
            session.subjectLabel || "Mathematics"
          );
        } catch {
          /* ignore */
        }

        await ctx.replyWithHTML(
          `📚 Try <code>/notes ${first}</code> for KCSE-style notes.\n` +
            `📝 Or a quick set: <code>/drill ${first} hard</code>`
        );
      }
    } catch (err: any) {
      const msg = String(err?.message || err);
      await ctx.reply(`❌ Couldn’t remark: ${msg}`);
    }
  });
}
