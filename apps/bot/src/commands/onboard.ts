import { Telegraf, Markup } from "telegraf";
import type { Context } from "telegraf";
import { getCollections } from "../lib/db.js";
import { openSubjectPicker } from "./subjects.js";
import { sendSmartStart } from "./smartStart.js";
import { startStudyForSubject } from "./study.js";
import { ensureUserExists } from "../utils/ensureUser.js";

const btn = (text: string, data: string) => Markup.button.callback(text, data);
const gradeKb = () =>
  Markup.inlineKeyboard([
    [btn("A", "SET_GRADE:A"), btn("A-", "SET_GRADE:A-"), btn("B+", "SET_GRADE:B+")],
    [btn("B", "SET_GRADE:B"), btn("B-", "SET_GRADE:B-"), btn("C+", "SET_GRADE:C+")],
    [btn("C", "SET_GRADE:C"), btn("C-", "SET_GRADE:C-"), btn("D+", "SET_GRADE:D+")],
    [btn("D", "SET_GRADE:D"), btn("D-", "SET_GRADE:D-")],
  ]);

export function registerOnboard(bot: Telegraf) {
  // pick KCSE year
  bot.action(/^SET_YEAR:(\d{4})$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const examYear = Number(ctx.match[1]);
    const { users } = await getCollections();
    const telegramId = ctx.from!.id.toString();

    await ensureUserExists(telegramId);

    await users.updateOne(
      { telegramId },
      { $set: { "profile.examYear": examYear, updatedAt: new Date() } },
      { upsert: true }
    );

    await ctx.reply(
      `Nice — set to *KCSE ${examYear}*.\n\nWhat grade are you aiming for in KCSE?`,
      { parse_mode: "Markdown", ...gradeKb() }
    );
  });

  // pick Form level
  bot.action(/^SET_FORM:(\d)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const form = Number(ctx.match[1]);
    const { users } = await getCollections();
    const telegramId = ctx.from!.id.toString();

    await ensureUserExists(telegramId);

    await users.updateOne(
      { telegramId },
      { $set: { "profile.formLevel": form, updatedAt: new Date() } },
      { upsert: true }
    );

    await ctx.reply(
      `Locked in *Form ${form}*.\n\nWhat grade are you aiming for by KCSE?`,
      { parse_mode: "Markdown", ...gradeKb() }
    );
  });

  // save target grade → subject picker or smart start
  bot.action(/^SET_GRADE:([A-D](?:\+|-)?)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const grade = ctx.match[1];
    const { users } = await getCollections();
    const telegramId = ctx.from!.id.toString();

    await ensureUserExists(telegramId);

    await users.updateOne(
      { telegramId },
      { $set: { "profile.targetGrade": grade, updatedAt: new Date() } },
      { upsert: true }
    );

    await ctx.reply("Setup saved ✅");

    const u = await users.findOne({ telegramId }, { projection: { "profile.subjects": 1 } });
    const subjects: string[] = Array.isArray(u?.profile?.subjects) ? u!.profile!.subjects : [];

    if (!subjects || subjects.length < 7) {
      return openSubjectPicker(ctx);
    }
    return sendSmartStart(ctx);
  });

  // skip straight to subjects
  bot.action("SKIP", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    return openSubjectPicker(ctx);
  });

  // quick subject launchers (call study directly)
  bot.action("START_ENG", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await startStudyForSubject(ctx as any, "eng");
  });

  bot.action("START_KIS", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await startStudyForSubject(ctx as any, "kis");
  });

  bot.action("SWITCH_QUICK", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    return openSubjectPicker(ctx);
  });

  bot.action(["UP_LITE", "UP_STEADY", "UP_SERIOUS", "UP_CLUB", "CLOSE"], async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
  });
}
