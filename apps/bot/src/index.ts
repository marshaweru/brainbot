import 'dotenv/config';
import { Telegraf } from 'telegraf';
import express from 'express';
import { router as mpesaRouter } from './routes/mpesa/c2b-confirmation';
import studyCmd from './commands/study';
import meCmd from './commands/me';
import { registerOnboard } from './commands/onboard';
import { registerStudyActions } from './commands/studyActions';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const PORT = Number(process.env.PORT || 8787);
if (!BOT_TOKEN) throw new Error('❌ TELEGRAM_BOT_TOKEN is missing');

const bot = new Telegraf(BOT_TOKEN);
registerOnboard(bot);
bot.command('study', studyCmd);
bot.command('me', meCmd);
registerStudyActions(bot);

bot.catch((err) => console.error('🤖 Bot error:', err));
bot.launch().then(() => console.log('🤖 Bot launched (polling)'));

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use('/api/mpesa/c2b/confirmation', mpesaRouter);
app.get('/health', (_, res) => res.json({ ok: true }));
app.listen(PORT, () => console.log(`🌐 Express on http://localhost:${PORT}`));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
