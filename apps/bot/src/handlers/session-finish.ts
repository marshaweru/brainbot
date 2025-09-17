// apps/bot/src/handlers/session-finish.ts
import { Telegraf } from "telegraf";
import * as sessionRepo from "../repo/sessionRepo.js";
import { markSessionAndSummarize } from "../repo/markingRepo.js";
import { buildFeedbackMessage } from "../feedback/render.js";
import { offerExportPdf } from "../services/pdf-export.js";
import { compileNotesForWeakTopics } from "../services/notes-service.js";

export function registerSessionFinish(bot: Telegraf) {
  bot.command("finish", async (ctx) => {
    const telegramId = String(ctx.from?.id ?? "");

    // 1) Load active session (we’ll mark by explicit sessionId)
    const active = await sessionRepo.getActiveByTelegramId(telegramId);
    if (!active) {
      return ctx.reply("No active session. Start with /session first.");
    }

    try {
      // 2) Run marking pipeline (marker handles:
      //    - handleMarking + toFeedback
      //    - save Performance
      //    - upsert latest-feedback snapshot (for /pdf)
      //    - HMAC post to web /api/session-complete)
      const { feedback } = await markSessionAndSummarize({
        sessionId: String((active as any)._id),
        subjectLabel: active.subjectLabel || "Mathematics",
      });

      // 3) Render examiner-style feedback (HTML)
      const html = await buildFeedbackMessage(feedback);
      await ctx.reply(html, { parse_mode: "HTML" });

      // 4) Offer PDF export button (uses the durable snapshot written by the marker)
      await offerExportPdf(ctx);

      // 5) Suggest next steps: notes + drills
      const weakTopics: string[] = Array.isArray(feedback?.weakTopics)
        ? feedback.weakTopics
            .map((w: any) => (typeof w === "string" ? w : String(w?.topic ?? "")))
            .filter(Boolean)
        : [];

      if (weakTopics.length) {
        const first = weakTopics[0];
        // Optional: precompile notes to warm cache
        try {
          await compileNotesForWeakTopics(weakTopics.slice(0, 2), active.subjectLabel || "Mathematics");
        } catch { /* best-effort only */ }

        await ctx.replyWithHTML(
          `📚 Try <code>/notes ${first}</code> for KCSE-style notes.\n` +
          `📝 Or a quick set: <code>/drill ${first} hard</code>`
        );
      } else {
        await ctx.reply("Looks solid! You can still use /notes to revise any topic.");
      }

      // 6) Close the session cleanly (idempotent)
      try {
        await sessionRepo.finishActive(telegramId);
      } catch {
        // ignore if already closed by other flow
      }
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (/No uploads/i.test(msg)) {
        return ctx.reply("I didn’t see any answers yet. Send photos/voice/PDF/text, then type /finish.");
      }
      await ctx.reply(`Couldn’t mark that session: ${msg}`);
    }
  });
}
