// apps/bot/src/commands/studyActions.ts
import { Telegraf, Context, Markup } from "telegraf";
import { ocrImages, describeImages } from "../lib/openai";
import { pickBestPhotoId, telegramFileAsDataUrl } from "../lib/telegramFiles";
import { pushPending, listPending, clearPending } from "../lib/markingInbox";

export function sessionButtons(pdfUrl?: string) {
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

export function registerStudyActions(bot: Telegraf<Context>) {
  bot.action("DO_QUICK", async (ctx, next) => { await ctx.answerCbQuery().catch(() => {}); return next(); });

  bot.action("SWITCH_SUBJECT", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await ctx.telegram.sendMessage(
      ctx.chat!.id,
      "Subject switch moved here:",
      { reply_markup: Markup.inlineKeyboard([[Markup.button.callback("🔁 Switch Subject", "SWITCH_QUICK")]]) as any }
    );
  });

  // Start fresh collection in DB
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

  // Photos → pick best variant, store in DB
  bot.on("photo", async (ctx) => {
    const photos = (ctx.message as any)?.photo as Array<{ file_id: string; width?: number; height?: number }>;
    const bestId = pickBestPhotoId(photos);
    if (!bestId) return;
    const count = await pushPending(ctx, { kind: "photo", fileId: bestId, addedAt: new Date() });
    await ctx.reply(`📸 Got that page. (${count} queued) Send the rest, then type *done*.`, { parse_mode: "Markdown" });
  });

  // Documents → accept image/* or PDF; store in DB
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

  // Finalize → load from DB, process, then clear DB
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

      const feedback = await describeImages(images, "score");
      await ctx.reply(`🧑🏽‍🏫 *Feedback & Suggested Score*\n\n${feedback}`, { parse_mode: "Markdown" });

      await ctx.reply(
        "Want another drill right away?",
        Markup.inlineKeyboard([
          [Markup.button.callback("⭐ Get Session", "DO_QUICK")],
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
