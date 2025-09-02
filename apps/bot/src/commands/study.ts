// apps/bot/src/commands/study.ts
import type { Telegraf, Context } from "telegraf";
import { Markup } from "telegraf";
import { renderMarkdownToPdf } from "../lib/pdf.js";
import { generateSession, type GenerateSessionResult } from "../lib/session.js";
import { getCollections } from "../lib/db.js";
import { SUBJECT_EMOJI, type SubjectSlug, type TierCode } from "../prompts/system.js";
import { sessionButtons } from "./studyActions.js"; // your existing helper

function labelFor(slug: SubjectSlug): string {
  const map: Record<SubjectSlug, string> = {
    eng: "English", kis: "Kiswahili", mat: "Mathematics",
    bio: "Biology", chem: "Chemistry", phy: "Physics", gsc: "General Science",
    his: "History & Government", geo: "Geography", cre: "CRE",
    fr: "French", ger: "German", arb: "Arabic",
  };
  return map[slug] || "Subject";
}

/** Launch a session for a slug (used by START_SESSION button) */
export async function startStudyForSubject(ctx: Context, slug: SubjectSlug) {
  const telegramId = ctx.from!.id.toString();

  // Resolve tier + any hints you keep in DB
  const { users } = await getCollections();
  const u = await users.findOne(
    { telegramId },
    { projection: { "plan.tier": 1 } }
  );
  const tier = ((u as any)?.plan?.tier || "lite") as TierCode;

  // Build minimal opts (topic is picked by the LLM prompt internally if you want)
  const label = labelFor(slug);
  const topic = "High-frequency focus"; // or your own selector

  let res: GenerateSessionResult;
  try {
    res = await generateSession({ subject: slug, label, topic, tier });
  } catch (e: any) {
    console.error("[study] generateSession error:", e?.message || e);
    await ctx.reply(
      "Couldn’t start that session. Tap below to try again:",
      Markup.inlineKeyboard([[Markup.button.callback("▶️ Retry", "START_SESSION")]])
    );
    return;
  }

  // Send the content (Telegram-safe chunks)
  for (const chunk of res.chunksV2) {
    await ctx.reply(chunk, { parse_mode: "MarkdownV2" }).catch(() => ctx.reply(chunk));
  }

  // PDF (best-effort)
  try {
    const { filePath, filename } = await renderMarkdownToPdf(res.pdfMarkdown, `${label} — Study Pack`);
    await ctx.replyWithDocument(
      { source: filePath, filename },
      { caption: "⬇️ Download the session as PDF" }
    );
  } catch (e: any) {
    await ctx.reply(`(PDF render skipped: ${e?.message || e})`);
  }

  // Action buttons
  await ctx.reply(
    "When you finish, tap *Mark My Work*.",
    { parse_mode: "Markdown", reply_markup: (sessionButtons() as any).reply_markup }
  );
}

/** Telegraf wiring */
export function registerStudy(bot: Telegraf<Context>) {
  bot.command("study", async (ctx) => {
    await ctx.reply(
      "⭐ Today: Mathematics — high-frequency focus.\nReady?",
      Markup.inlineKeyboard([
        [Markup.button.callback("⭐ Get Session", "START_SESSION")],
        [Markup.button.callback("🔁 Switch Subject", "SWITCH_QUICK"), Markup.button.callback("📅 Plan", "OPEN_PLAN")],
      ])
    );
  });
}
