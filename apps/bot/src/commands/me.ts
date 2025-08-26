// apps/bot/src/commands/me.ts
import { Context, Markup } from "telegraf";
import { getCollections } from "../lib/db";
import { ensureDailyReset, fmtDate } from "../utils/daily";
import { getVoicePrefs } from "../utils/prefs";

export default async function (ctx: Context) {
  const telegramId = ctx.from?.id?.toString();
  if (!telegramId) return ctx.reply("😬 Couldn’t read your Telegram ID. Try again.");

  const { users } = await getCollections();
  let user = await users.findOne({ telegramId });
  if (!user) return ctx.reply("👋 Type /start to set up your BrainBot profile.");

  const updated = await ensureDailyReset(users as any, user as any);
  if (updated) user = await users.findOne({ telegramId });

  const plan = user?.plan;
  const today = user?.daily || { minutesUsed: 0, subjectsDone: 0 };
  const expires = plan?.expiresAt ? new Date(plan.expiresAt) : null;

  // per-user voice prefs
  const voice = await getVoicePrefs(telegramId);
  const voiceStatus = voice.tts ? "ON" : "OFF";
  const langLabel = voice.lang === "en" ? "English" : voice.lang === "sw" ? "Kiswahili" : "auto";
  const voiceLine = `🎧 *Voice:* ${voiceStatus} — ${voice.tts ? "Voice + Text" : "Text only"} (lang: ${langLabel})`;

  const lines: string[] = [];

  if (plan) {
    // Paid plans — show daily allowances without minutes
    lines.push(`📦 *Plan:* ${plan.label} (${plan.code})`);
    lines.push(`📅 *Daily:* ⏱️ ${plan.hoursPerDay}h • 📚 ${plan.subjectsPerDay} subjects/day`);
    lines.push(`✅ *Today:* ${today.subjectsDone || 0} subject(s) done`);
    lines.push(`🗓️ *Expires:* ${expires ? fmtDate(expires) : "—"}`);
  } else {
    // Free intro — 2 sessions total (no minutes)
    lines.push(`📦 *Plan:* Free Intro — *2 free sessions*`);
    lines.push(`✅ *Today:* ${today.subjectsDone || 0} subject(s) done`);
    lines.push(`💡 Tip: Start with *Mathematics* plus *English* or *Kiswahili*.`);
  }

  lines.push(voiceLine);
  lines.push("", `⭐ *Next:* /study → Get Session`);

  await ctx.reply(lines.join("\n"), {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      [Markup.button.callback("⚙️ Change voice settings", "VOICE_OPEN")],
    ]),
  });
}
