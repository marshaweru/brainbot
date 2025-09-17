import { Telegraf, Context } from "telegraf";
import { markSessionAndSummarize } from "../repo/markingRepo.js";
import { savePerformance } from "../repo/performanceRepo.js";
import { buildFeedbackMessage } from "../feedback/render.js";
import { offerExportPdf } from "../services/pdf-export.js";
import { compileNotesForWeakTopics } from "../services/notes-service.js";
import { SessionModel } from "../models/Session.js";

/**
 * /remark <sessionId>
 *
 * Allows re-running marking + feedback for a past session.
 */
export function registerRemark(bot: Telegraf) {
  bot.command("remark", async (ctx: Context) => {
    const text = (ctx.message as any).text || "";
    const parts = text.split(" ").filter(Boolean);
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

      // 2) Run marking pipeline again
      const { raw, feedback } = await markSessionAndSummarize({
        sessionId,
        subjectLabel: session.subjectLabel || "Mathematics",
      });

      // 3) Send feedback
      const html = await buildFeedbackMessage(feedback);
      await ctx.reply(html, { parse_mode: "HTML" });

      // 4) Persist updated performance record
      const total = Number(feedback?.totalScore ?? feedback?.score ?? 0);
      const outOf = Number(feedback?.outOf ?? 100);
      const gradeNumeric = Math.round((total / (outOf || 100)) * 100);
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

      // 5) Offer PDF export
      await offerExportPdf(ctx);

      // 6) Suggest notes/drills
      if (weakTopics.length) {
        const first = weakTopics[0];
        try {
          await compileNotesForWeakTopics(weakTopics.slice(0, 2), session.subjectLabel || "Mathematics");
        } catch { /* ignore errors */ }

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
