import { Context, Markup } from 'telegraf';
import { getCollections } from '../lib/db';
import { ensureDailyReset, nairobiDate } from '../utils/daily';
import { DAILY_TOKEN_CAP } from '../utils/tokenBudget';
import { defaultTrial } from '../utils/trial';

export default async function (ctx: Context) {
  const telegramId = ctx.from?.id?.toString();
  if (!telegramId) return ctx.reply('😬 Couldn’t read your Telegram ID.');

  const { users, usage } = await getCollections();
  let user = await users.findOne({ telegramId });
  if (!user) {
    await users.insertOne({ telegramId, createdAt: new Date(), updatedAt: new Date(),
      plan: null, daily: { date: null, minutesUsed: 0, subjectsDone: 0 }, trial: defaultTrial() });
    user = await users.findOne({ telegramId });
  }

  await ensureDailyReset(users, user);
  user = await users.findOne({ telegramId });

  const plan = user?.plan;
  const today = user?.daily || { minutesUsed: 0, subjectsDone: 0 };
  const date = nairobiDate();

  if (!plan) {
    const trial = user.trial ?? defaultTrial();
    const introBanner =
      `🎁 *Free Starter Active*: ${Math.max(trial.minutesRemaining,0)} mins left • 2 subjects/day\n` +
      `Upgrade anytime for more time/subjects.`;
    if (today.subjectsDone >= 2) {
      return ctx.reply(`${introBanner}\n\nYou’ve hit 2 subjects today — come back tomorrow or upgrade (/plan).`, { parse_mode: 'Markdown' });
    }
    const todayUsage = await usage.findOne({ telegramId, date }) || { tokens: 0 };
    const cap = 10_000;
    if (todayUsage.tokens >= cap) {
      return ctx.reply(`${introBanner}\n\n⛔ You’ve reached today’s token safety cap. See you tomorrow.`, { parse_mode: 'Markdown' });
    }
    return ctx.reply(
      `${introBanner}\n\nPick today’s focus:\n` +
      `⚡ Quick Wins (high-frequency marks)\n` +
      `🛠️ Fix Weakness (based on your mistakes)\n` +
      `📄 Past-Paper Drill (mini set)`,
      Markup.inlineKeyboard([
        [Markup.button.callback('⚡ Get Session', 'DO_QUICK')],
        [Markup.button.callback('🔁 Switch Subject', 'SWITCH_SUBJECT'),
         Markup.button.callback('🗓️ Plan', 'OPEN_PLAN')],
      ])
    );
  }

  const cap = DAILY_TOKEN_CAP[plan.code];
  const todayUsage = await usage.findOne({ telegramId, date }) || { tokens: 0 };
  if (plan && (today.subjectsDone >= plan.subjectsPerDay || today.minutesUsed >= plan.hoursPerDay * 60)) {
    return ctx.reply(`🎉 You’ve maxed today. See you tomorrow! Try /plan to tweak your timetable.`);
  }
  if (todayUsage.tokens >= cap) {
    return ctx.reply(`⛔ You’ve reached today’s token limit. Come back tomorrow or upgrade for more time.`);
  }

  return ctx.reply(
    `Pick today’s focus:\n` +
    `⚡ Quick Wins (high-frequency marks)\n` +
    `🛠️ Fix Weakness (based on your mistakes)\n` +
    `📄 Past-Paper Drill (mini set)`,
    Markup.inlineKeyboard([
      [Markup.button.callback('⚡ Get Session', 'DO_QUICK')],
      [Markup.button.callback('🔁 Switch Subject', 'SWITCH_SUBJECT'),
       Markup.button.callback('🗓️ Plan', 'OPEN_PLAN')],
    ])
  );
}
