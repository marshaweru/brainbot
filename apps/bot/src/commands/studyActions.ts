import { Telegraf, Context, Markup } from 'telegraf';
import { generateSession } from '../lib/session';
import { estimateTokensByChars } from '../utils/tokenBudget';
import { getCollections } from '../lib/db';

function sessionButtons(pdfUrl?: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Mark My Work', 'MARK_UPLOAD')],
    [Markup.button.url('⬇️ Download PDF', pdfUrl || 'https://example.com')],
    [Markup.button.callback('🔁 Switch Subject', 'SWITCH_SUBJECT')],
  ]);
}

export function registerStudyActions(bot: Telegraf<Context>) {
  bot.action('DO_QUICK', async (ctx) => {
    await ctx.answerCbQuery();
    const subject = 'Geography';
    const { content } = await generateSession({ subject, mode: 'quick' });
    await ctx.reply(content, { parse_mode: 'Markdown', ...sessionButtons() });
    const tokens = estimateTokensByChars(content);
    const { usage } = await getCollections();
    const date = new Date().toISOString().slice(0,10);
    await usage.updateOne({ telegramId: String(ctx.from?.id), date }, { $inc: { tokens }, $set: { updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  });
}
