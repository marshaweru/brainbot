// apps/bot/src/handlers/session-finish.ts
import { Telegraf } from "telegraf";
import * as sessionRepo from "../repo/sessionRepo.js";
import { markSessionAndSummarize } from "../repo/markingRepo.js";
import { buildFeedbackMessage } from "../feedback/render.js";
import { offerExportPdf } from "../services/pdf-export.js";
import { compileNotesForWeakTopics } from "../services/notes-service.js";
import { usePaper } from "../repo/planRepo.js";

// tiny pretty-duration helper
function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const parts: string[] = []; // 👈 add the type
  if (h) parts.push(`${h}h`);
  if (m || (!h && !ss)) parts.push(`${m}m`);
  if (ss && !h) parts.push(`${ss}s`);
  return parts.join(" ");
}


export function registerSessionFinish(bot: Telegraf) {
  bot.command("finish", async (ctx) => {
    const telegramId = String(ctx.from?.id ?? "");

    // 1) Load active session (we’ll mark by explicit sessionId)
    const active = await sessionRepo.getActiveByTelegramId(telegramId);
    if (!active) {
      return ctx.reply("No active session. Start with /session first.");
    }

    // quick timing snapshot (repo now populates these when the session starts)
    const startedAt = active.startedAt ? new Date(active.startedAt) : null;
    const examEndsAt = active.examEndsAt ? new Date(active.examEndsAt as any) : null;
    const uploadEndsAt = active.uploadEndsAt ? new Date(active.uploadEndsAt as any) : null;
    const expiresAt = active.expiresAt ? new Date(active.expiresAt as any) : null;

    // preflight: warn if nothing uploaded
    try {
      // If your marking pipeline throws on "No uploads", this is just a friendlier fast-path
      const sessionId = String((active as any)._id ?? "");
      // 2) Run marking pipeline (handles saving performance + feedback snapshot)
      const { feedback } = await markSessionAndSummarize({
        sessionId,
        subjectLabel: active.subjectLabel || "Mathematics",
      });

      // 3) Render examiner-style feedback (HTML)
      const html = await buildFeedbackMessage(feedback);
      await ctx.reply(html, { parse_mode: "HTML" });

      // 4) Offer PDF export button (uses durable snapshot)
      await offerExportPdf(ctx);

      // 5) Suggest next steps: notes + drills (and warm cache a bit)
      const weakTopics: string[] = Array.isArray(feedback?.weakTopics)
        ? feedback.weakTopics
            .map((w: any) => (typeof w === "string" ? w : String(w?.topic ?? "")))
            .filter(Boolean)
        : [];

      if (weakTopics.length) {
        const first = weakTopics[0];
        // Warm two topics best-effort
        compileNotesForWeakTopics(weakTopics.slice(0, 2), active.subjectLabel || "Mathematics").catch(() => {});
        await ctx.replyWithHTML(
          `📚 Try <code>/notes ${first}</code> for KCSE-style notes.\n` +
          `📝 Or a quick set: <code>/drill ${first} hard</code>`
        );
      } else {
        await ctx.reply("Looks solid! You can still use /notes to revise any topic.");
      }

      // 6) Timing recap (nice UX)
      if (startedAt && (uploadEndsAt || expiresAt)) {
        const now = new Date();
        const totalCap = (uploadEndsAt ?? expiresAt)!; // both point to the governing window
        const usedMs = now.getTime() - startedAt.getTime();
        const capMs = totalCap.getTime() - startedAt.getTime();
        const delta = capMs - usedMs;

        const within = delta >= 0;
        const line =
          (examEndsAt ? `Exam ended ~${fmt(examEndsAt.getTime() - startedAt.getTime())} after start. ` : "") +
          `Total window was ${fmt(capMs)}; you used ${fmt(usedMs)} ` +
          (within ? `(${fmt(delta)} remaining).` : `(${fmt(-delta)} over).`);

        await ctx.reply(`⏱️ Session timing: ${line}`);
      }

      // 7) Close the session cleanly (idempotent) and count a paper usage
      try {
        await sessionRepo.finishActive(telegramId);
      } catch { /* ignore double-finish */ }
      usePaper(telegramId).catch(() => {}); // non-blocking

    } catch (err: any) {
      const msg = String(err?.message || err);
      if (/No uploads/i.test(msg)) {
        return ctx.reply("I didn’t see any answers yet. Send photos/voice/PDF/text, then type /finish.");
      }
      await ctx.reply(`Couldn’t mark that session: ${msg}`);
    }
  });
}
