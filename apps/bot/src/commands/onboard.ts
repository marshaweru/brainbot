import { Telegraf, Context, Markup } from 'telegraf';
import { getCollections } from '../lib/db';

export function registerOnboard(bot: Telegraf<Context>) {
  bot.command('start', async (ctx) => {
    const name = ctx.from?.first_name || 'friend';
    await ctx.reply(
      `👋 Hey ${name}! I’m *BrainBot*, your KCSE study buddy.\n\n` +
      `What level are you at?`,
      { parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('KCSE 2025','LEVEL_KCSE_2025'), Markup.button.callback('KCSE 2026','LEVEL_KCSE_2026')],
          [Markup.button.callback('KCSE 2027','LEVEL_KCSE_2027')],
          [Markup.button.callback('Form 1','LEVEL_F1'), Markup.button.callback('Form 2','LEVEL_F2')],
          [Markup.button.callback('Form 3','LEVEL_F3'), Markup.button.callback('Form 4','LEVEL_F4')],
          [Markup.button.callback('Skip','LEVEL_SKIP')]
        ]) }
    );
  });

  bot.action(/^LEVEL_/, async (ctx) => {
    await ctx.answerCbQuery();
    const { users } = await getCollections();
    const telegramId = String(ctx.from?.id);
    await users.updateOne({ telegramId }, { $set: { level: ctx.match?.input, updatedAt: new Date() } }, { upsert: true });
    await ctx.editMessageText(`Cool. Which subjects will you sit?\n(tap a few, then press Done)`, {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('Math','SUBJ_Mathematics'), Markup.button.callback('English','SUBJ_English')],
        [Markup.button.callback('Kiswahili','SUBJ_Kiswahili'), Markup.button.callback('Physics','SUBJ_Physics')],
        [Markup.button.callback('Chemistry','SUBJ_Chemistry'), Markup.button.callback('Biology','SUBJ_Biology')],
        [Markup.button.callback('Geography','SUBJ_Geography'), Markup.button.callback('History','SUBJ_History')],
        [Markup.button.callback('CRE','SUBJ_CRE'), Markup.button.callback('Business Studies','SUBJ_Business Studies')],
        [Markup.button.callback('Done','SUBJ_DONE')]
      ])
    });
  });

  bot.action(/^SUBJ_/, async (ctx) => {
    await ctx.answerCbQuery();
    const subj = ctx.match?.input.replace('SUBJ_','');
    const { users } = await getCollections();
    const telegramId = String(ctx.from?.id);
    await users.updateOne({ telegramId }, { $addToSet: { subjects: subj }, $set: { updatedAt: new Date() } }, { upsert: true });
  });

  bot.action('SUBJ_DONE', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(`Goal grade for KCSE?`, {
      ...Markup.inlineKeyboard([[
        Markup.button.callback('C','GOAL_C'),
        Markup.button.callback('B','GOAL_B'),
        Markup.button.callback('A','GOAL_A')
      ]])
    });
  });

  bot.action(/^GOAL_/, async (ctx) => {
    await ctx.answerCbQuery();
    const { users } = await getCollections();
    const telegramId = String(ctx.from?.id);
    await users.updateOne({ telegramId }, { $set: { goal: ctx.match?.input.replace('GOAL_',''), updatedAt: new Date() } });
    await ctx.editMessageText(
      `Nice — you’re set.\n\n` +
      `🎁 *Free Starter: 5h total • 2 subjects/day*\n` +
      `Tap **Get Session** to begin.`,
      { parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('⚡ Get Session','DO_QUICK')],
          [Markup.button.callback('🔁 Switch Subject','SWITCH_SUBJECT'), Markup.button.callback('🗓️ Plan','OPEN_PLAN')]
        ])}
    );
  });
}
