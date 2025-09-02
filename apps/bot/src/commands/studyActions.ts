// apps/bot/src/commands/studyActions.ts
import { Telegraf, Context, Markup } from "telegraf";
import { ocrImages, describeImages } from "../lib/openai.js";
import { pickBestPhotoId, telegramFileAsDataUrl } from "../lib/telegramFiles.js";
import { pushPending, listPending, clearPending } from "../lib/markingInbox.js";
import { getCollections } from "../lib/db.js";
import { getLastSessionMeta } from "../utils/prefs.js";
import { startStudyForSubject } from "./study.js";

// NEW: free-trial state for delayed upsell
import { getFreeState } from "../lib/free.js";
import { getTrialState } from "../lib/trialStore.js";

export function sessionButtons(pdfUrl?: string): { reply_markup: any }  {
  const rows: any[] = [
    [Markup.button.callback("✅ Mark My Work", "MARK_UPLOAD")],
    [
      Markup.button.callback("🔁 Switch Subject", "SWITCH_QUICK"),
      Markup.button.callback("📅 Plan", "OPEN_PLAN"),
    ],
  ];
  if (pdfUrl) rows.splice(1, 0, [Markup.button.url("⬇️ Download PDF", pdfUrl)]);
  return Markup.inlineKeyboard(rows);
}

function chunk(str: string, n = 3500) {
  const parts: string[] = [];
  let i = 0;
  while (i < str.length) { parts.push(str.slice(i, i + n)); i += n; }
  return parts;
}

function upgradeKb() {
  return Markup.inlineKeyboard([
    [Markup.button.url("🌐 Pricing", "https://brainbot-4jqh.onrender.com/pricing")],
    [Markup.button.url("🔥 Founder’s Offer", "https://brainbot-4jqh.onrender.com/pricing#founder")],
  ]);
}

export function registerStudyActions(bot: Telegraf<Context>) {
  bot.action("DO_QUICK", async (ctx, next) => { await ctx.answerCbQuery().catch(() => {}); return next(); });

  // ⭐ Get Session → start current focus subject
  bot.action("START_SESSION", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    try {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) return;

      const { users } = await getCollections();
      const u = await users.findOne(
        { telegramId },
        { projection: { "profile.focusSubject": 1 } }
      );
      const slug = (u?.profile?.focusSubject as string) || "mat";

      try { await ctx.editMessageReplyMarkup(undefined); } catch {}
      await startStudyForSubject(ctx, slug);
    } catch (e: any) {
      console.error("[START_SESSION] error:", e?.message || e);
      await ctx.reply(
        "Couldn’t launch that session. Tap to retry:",
        Markup.inlineKeyboard([[Markup.button.callback("▶️ Try Again", "START_SESSION")]])
      );
    }
  });

  bot.action("SWITCH_SUBJECT", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await ctx.telegram.sendMessage(
      ctx.chat!.id,
      "Subject switch moved here:",
      { reply_markup: Markup.inlineKeyboard([[Markup.button.callback("🔁 Switch Subject", "SWITCH_QUICK")]]) as any }
    );
  });

  /** ── REVEAL ANSWERS ───────────────────────────────────── */
  bot.action(/^REVEAL:([a-z0-9]+):([A-Za-z0-9_-]+)$/i, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const sessionId = String((ctx.match as any)[1]);
    const qid = String((ctx.match as any)[2]);

    const { sessions } = await getCollections();
    const s = await sessions.findOne({ sessionId, telegramId: String(ctx.from?.id) });
    if (!s) return ctx.reply("Session not found. Start a new one with /study.");

    const q = (s.data?.quiz || []).find((x: any) => String(x.id) === qid);
    if (!q) return ctx.reply("That question wasn’t found in this session.");

    await sessions.updateOne(
      { sessionId },
      { $addToSet: { revealed: qid }, $set: { updatedAt: new Date() } }
    );

    const md = [
      `**${qid} — Model Answer**`,
      q.answer_md?.trim() || "_(no answer)_",
      q.traps_md ? `\n_Exam traps:_\n${q.traps_md}` : "",
    ].join("\n");
    await ctx.reply(md, { parse_mode: "Markdown" });
  });

  bot.action(/^REVEAL_ALL:([a-z0-9]+)$/i, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const sessionId = String((ctx.match as any)[1]);

    const { sessions } = await getCollections();
    const s = await sessions.findOne({ sessionId, telegramId: String(ctx.from?.id) });
    if (!s) return ctx.reply("Session not found. Start a new one with /study.");

    const quiz = Array.isArray(s.data?.quiz) ? s.data.quiz : [];
    if (!quiz.length) return ctx.reply("This session has no quiz.");

    await sessions.updateOne(
      { sessionId },
      { $set: { revealed: quiz.map((q: any) => String(q.id)), updatedAt: new Date() } }
    );

    for (const q of quiz) {
      const md = [
        `**${q.id} — Model Answer**`,
        q.answer_md?.trim() || "_(no answer)_",
        q.traps_md ? `\n_Exam traps:_\n${q.traps_md}` : "",
      ].join("\n");
      await ctx.reply(md, { parse_mode: "Markdown" });
    }
  });

  /** ── MARKING INBOX (images/PDF → OCR → feedback) ───────── */
  bot.action("MARK_UPLOAD", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await clearPending(ctx);
    await ctx.reply(
      [
        "📤 *Send your work now*",
        "• Snap *clear photos* of all pages _or_ attach a *PDF*",
        "• You can send multiple photos one by one",
        "• Add any notes (numbered answers help!)",
        "",
        "When you’ve sent everything, reply with *done* and I’ll mark it.",
      ].join("\n"),
      { parse_mode: "Markdown" }
    );
  });

  bot.on("photo", async (ctx) => {
    const photos = (ctx.message as any)?.photo as Array<{ file_id: string; width?: number; height?: number }>;
    const bestId = pickBestPhotoId(photos);
    if (!bestId) return;
    const count = await pushPending(ctx, { kind: "photo", fileId: bestId, addedAt: new Date() });
    await ctx.reply(`📸 Got that page. (${count} queued) Send the rest, then type *done*.`, { parse_mode: "Markdown" });
  });

  bot.on("document", async (ctx) => {
    const doc = (ctx.message as any)?.document as { file_id: string; mime_type?: string };
    if (!doc?.file_id) return;
    const mt = (doc.mime_type || "").toLowerCase();
    if (mt.startsWith("image/")) {
      const count = await pushPending(ctx, { kind: "image", fileId: doc.file_id, mime: mt, addedAt: new Date() });
      await ctx.reply(`🖼️ Image added. (${count} queued) When done, type *done*.`, { parse_mode: "Markdown" });
    } else if (mt === "application/pdf") {
      const count = await pushPending(ctx, { kind: "pdf", fileId: doc.file_id, mime: mt, addedAt: new Date() });
      await ctx.reply(`📄 PDF added. (${count} queued) When done, type *done*.`, { parse_mode: "Markdown" });
    } else {
      await ctx.reply(`⚠️ Unsupported document type: ${mt || "unknown"}. Please send images or a PDF.`);
    }
  });

  bot.hears(/^(done|finished|submit)[!.\s]*$/i, async (ctx) => {
    const items = await listPending(ctx);
    if (!items.length) {
      await ctx.reply("🤔 I don’t see any uploads yet. Send photos or a PDF, then type *done*.");
      return;
    }

    const MAX_IMAGES = 10;
    const images: { url: string }[] = [];

    await ctx.reply("🧠 Got it — crunching your work now…");

    // Convert Telegram files → data URLs
    for (const it of items.slice(0, MAX_IMAGES)) {
      try {
        const { dataUrl } = await telegramFileAsDataUrl(it.fileId);
        images.push({ url: dataUrl });
      } catch (e: any) {
        console.error("[marking] file fetch failed:", e?.message || e);
      }
    }

    if (!images.length) {
      await ctx.reply("⚠️ I couldn’t read the files. Try re-sending as photos or a PDF.");
      return;
    }

    try {
      const text = await ocrImages(images, "Prefer math as TeX where possible.");
      const chunks = chunk(text);
      await ctx.reply(`📝 *Extracted text (${chunks.length > 1 ? "part 1" : "full"})*`, { parse_mode: "Markdown" });
      for (let i = 0; i < chunks.length; i++) {
        const header = chunks.length > 1 ? `Part ${i + 1}/${chunks.length}\n\n` : "";
        await ctx.reply(header + chunks[i]);
      }

      // Use last-session meta to nudge rubric selection
      const ls = await getLastSessionMeta(String(ctx.from?.id));
      const subjectHint = ls?.subject ? `Subject: ${ls.subject}${ls.paper ? ` (${ls.paper})` : ""}. ` : "";

      const feedback = await describeImages(images, "score", subjectHint);
      await ctx.reply(`🧑🏽‍🏫 *Feedback & Suggested Score*\n\n${feedback}`, { parse_mode: "Markdown" });

      // 🔔 Delayed upsell: only after marking completes
      try {
        const telegramId = String(ctx.from?.id);
        const freeState = await getFreeState(telegramId);
        const trial = await getTrialState(telegramId);
        if ((freeState.remaining ?? 0) === 0 || (trial.sessionsRemaining ?? 0) === 0) {
          await ctx.reply(
            "🎉 Great work! You’ve finished your *2 free sessions*.\nUnlock *daily sessions* and *examiner-style marking*:",
            { parse_mode: "Markdown", ...upgradeKb() }
          );
        }
      } catch (e) {
        // non-fatal
      }

      // Offer another session
      await ctx.reply(
        "Want another drill right away?",
        Markup.inlineKeyboard([
          [Markup.button.callback("⭐ Get Session", "START_SESSION")],
          [Markup.button.callback("🔁 Switch Subject", "SWITCH_QUICK")],
        ])
      );
    } catch (e: any) {
      console.error("[marking] vision error:", e?.message || e);
      await ctx.reply("😵 I hit a snag while marking. Try again in a bit or re-send clearer photos.");
    } finally {
      await clearPending(ctx);
    }
  });

  bot.action("CLOSE", async (ctx) => { await ctx.answerCbQuery().catch(() => {}); });
}
