import { Telegraf, Markup } from "telegraf";
import type { Context } from "telegraf";
import { getCollections } from "../lib/db.js";
import { sendSmartStart, registerSmartStart } from "./smartStart.js";
import { openSubjectPicker } from "./subjects.js";
import { startStudyForSubject } from "./study.js";
import { ensureUserExists } from "../utils/ensureUser.js";

const btn = (text: string, data: string) => Markup.button.callback(text, data);

const levelKb = () =>
  Markup.inlineKeyboard([
    [btn("KCSE 2025", "SET_YEAR:2025"), btn("KCSE 2026", "SET_YEAR:2026"), btn("KCSE 2027", "SET_YEAR:2027")],
    [btn("Form 1", "SET_FORM:1"), btn("Form 2", "SET_FORM:2"), btn("Form 3", "SET_FORM:3"), btn("Form 4", "SET_FORM:4")],
  ]);

/** Register /start command */
export function registerStart(bot: Telegraf<Context>) {
  bot.start(async (ctx) => {
    try {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) return;

      // guard: make sure users doc exists (prevents race E11000)
      await ensureUserExists(telegramId);

      const { users } = await getCollections();
      const u = await users.findOne(
        { telegramId },
        { projection: { "profile.examYear": 1, "profile.formLevel": 1 } }
      );

      if (!u?.profile?.examYear) {
        await ctx.reply("🎯 Welcome! Which KCSE year or form are you in?", levelKb());
        return;
      }

      await sendSmartStart(ctx);
    } catch (e) {
      console.error("[/start error]", (e as any)?.message || e);
    }
  });

  // Handle `/start free` deep-link payload
  bot.hears(/^\/start\s+free$/, async (ctx) => {
    try {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) return;

      // guard first
      await ensureUserExists(telegramId);

      await ctx.reply(
        "🎁 Free Starter unlocked: 2 subject sessions total.\nWe’ll begin with Mathematics, then you’ll pick English or Kiswahili."
      );

      const { users } = await getCollections();
      await users.updateOne(
        { telegramId },
        { $set: { "profile.focusSubject": "mat", updatedAt: new Date() } },
        { upsert: true }
      );

      // Launch Mathematics now
      await startStudyForSubject(ctx as any, "mat");
    } catch (e) {
      console.error("[start.free] study error:", (e as any)?.message || e);
      await ctx.reply("⚠️ Could not start Mathematics. Please tap again to retry.");
    }
  });

  bot.action("OPEN_SUBJECT_PICKER", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    return openSubjectPicker(ctx);
  });
}
