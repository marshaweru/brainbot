// apps/bot/src/commands/subjects.ts
import { Telegraf, Markup } from "telegraf";
import type { Context } from "telegraf";
import { startStudyForSubject } from "./study.js";
import { getCollections } from "../lib/db.js";

/** Small helper to render the compulsory-subject picker */
export async function openSubjectPicker(ctx: Context): Promise<void> {
  const kb = Markup.inlineKeyboard([
    [Markup.button.callback("📐 Mathematics", "pick:mat")],
    [Markup.button.callback("📝 English", "pick:eng"), Markup.button.callback("🇰🇪 Kiswahili", "pick:kis")],
    [Markup.button.callback("⬅️ Cancel", "CLOSE")],
  ]);
  await ctx.reply("Choose your next compulsory subject:", kb);
}

/** Wire subject-pick actions so they LAUNCH immediately */
export function registerSubjectHandlers(bot: Telegraf): void {
  // quick switch opens picker
  bot.action("SWITCH_QUICK", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    return openSubjectPicker(ctx);
  });

  // close/hide keyboards
  bot.action("CLOSE", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    try {
      await ctx.editMessageReplyMarkup(undefined);
    } catch {}
  });

  // pick:<slug> → set focus in DB → start session now
  bot.action(/^pick:(mat|eng|kis)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const slug = (ctx.match?.[1] as "mat" | "eng" | "kis") || "mat";

    const telegramId = ctx.from?.id?.toString();
    if (telegramId) {
      const { users } = await getCollections();
      await users.updateOne(
        { telegramId },
        { $set: { "profile.focusSubject": slug }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true }
      );
    }

    // try to remove inline keyboard from the picker message (best-effort)
    try {
      await ctx.editMessageReplyMarkup(undefined);
    } catch {}

    // launch the session immediately (free trial is consumed only after success in study.ts)
    await startStudyForSubject(ctx as any, slug);
  });
}
