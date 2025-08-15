import { Context } from 'telegraf';
import { getCollections } from '../lib/db';
import { ensureDailyReset, fmtDate } from '../utils/daily';

export default async function (ctx: Context) {
  const telegramId = ctx.from?.id?.toString();
  if (!telegramId) return ctx.reply('😬 Couldn’t read your Telegram ID. Try again.');

  const { users } = await getCollections();
  let user = await users.findOne({ telegramId });
  if (!user) return ctx.reply('👋 Type /start to set up your BrainBot profile.');

  const updated = await ensureDailyReset(users, user);
  if (updated) user = await users.findOne({ telegramId });

  const plan = user?.plan;
  const today = user?.daily || { minutesUsed: 0, subjectsDone: 0 };
  const expires = plan?.expiresAt ? new Date(plan.expiresAt) : null;

  const lines: string[] = [];
  if (plan) {
    lines.push(`📦 *Plan:* ${plan.label} (${plan.code})`);
    lines.push(`⏱️ *Today:* ${today.minutesUsed || 0}/${(plan.hoursPerDay || 0)*60} mins • ${today.subjectsDone || 0}/${plan.subjectsPerDay || 0} subjects`);
    lines.push(`🗓️ *Expires:* ${expires ? fmtDate(expires) : '—'}`);
  } else {
    lines.push(`📦 *Plan:* Free Intro (5h total)`);
    lines.push(`⏱️ *Today:* ${today.minutesUsed || 0}/120 mins • ${today.subjectsDone || 0}/2 subjects`);
  }
  lines.push('', `⭐ *Next:* /study → Get Session`);
  await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
}
