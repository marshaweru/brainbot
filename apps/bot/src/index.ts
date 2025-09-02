// apps/bot/src/index.ts
import "dotenv/config";
import express from "express";
import { Telegraf, Markup, type Context } from "telegraf";

import { connectDB } from "./lib/db.js";
import { preflightModels, models } from "./lib/openai.js";

import { registerStudy } from "./commands/study.js";
import { registerStudyActions } from "./commands/studyActions.js";
import { registerDev } from "./commands/dev.js";
import { registerVoice } from "./commands/voice.js"; // <- if your file is at src/voice.ts, change to "./voice.js"

// ---------------------------------------------------------------------------
// Env / constants
// ---------------------------------------------------------------------------
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("❌ TELEGRAM_BOT_TOKEN is not set");

const PORT = Number(process.env.PORT || process.env.BOT_PORT || 8787);
const WEBHOOK_URL: string | null = process.env.BOT_WEBHOOK_URL
  ? String(process.env.BOT_WEBHOOK_URL).trim()
  : null;

// Telegraf options (keep untyped to avoid version/type drift)
const tgOpts = { handlerTimeout: 90_000 } as const;

// ---------------------------------------------------------------------------
// Health server
// ---------------------------------------------------------------------------
const app = express();

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/health/db", async (_req, res) => {
  try {
    const db = await connectDB();
    res.json({ ok: true, db: db.databaseName });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

let cachedMe:
  | { id: number; is_bot: boolean; first_name: string; username?: string }
  | null = null;

app.get("/health/bot", async (_req, res) => {
  try {
    if (!cachedMe) {
      const tmp = new Telegraf(BOT_TOKEN, tgOpts);
      cachedMe = (await tmp.telegram.getMe()) as any;
    }
    res.json({ ok: true, bot: cachedMe?.username || "(unknown)" });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Express on http://localhost:${PORT}`);
});

// ---------------------------------------------------------------------------
// Launch bot
// ---------------------------------------------------------------------------
async function launchBot() {
  await connectDB();

  const plan = { default: models.textDefault, heavy: models.textHeavy, vision: models.vision };
  try {
    const used = await preflightModels(plan);
    console.log("🧠 Model plan:", used);
  } catch (e: any) {
    console.warn("OpenAI preflight skipped:", e?.message || e);
  }

  const bot = new Telegraf<Context>(BOT_TOKEN, tgOpts);

  bot.start(async (ctx) => {
    await ctx.reply(
      "⭐ Today: Mathematics — high-frequency focus.\nReady?",
      Markup.inlineKeyboard([
        [Markup.button.callback("⭐ Get Session", "START_SESSION")],
        [
          Markup.button.callback("🔁 Switch Subject", "SWITCH_QUICK"),
          Markup.button.callback("📅 Plan", "OPEN_PLAN"),
        ],
      ])
    );
  });

  registerStudy(bot);
  registerStudyActions(bot);
  registerDev(bot);
  registerVoice(bot);

  try {
    if (WEBHOOK_URL) {
      const path = `/bot${BOT_TOKEN}`;
      await bot.telegram.setWebhook(`${WEBHOOK_URL}${path}`);
      app.use(bot.webhookCallback(path));
      console.log(`🔔 Webhook set: ${WEBHOOK_URL}${path}`);
    } else {
      try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: false });
        console.log("🔕 Webhook deleted, switching to polling");
      } catch {}
      await bot.launch();
      console.log("▶️ Bot launched (polling)");
    }
  } catch (e: any) {
    console.error("Bot launch error:", e?.message || e);
    process.exitCode = 1;
    return;
  }

  const stop = async () => {
    try { await bot.stop("SIGTERM"); } catch {}
    process.exit(0);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

launchBot().catch((e) => {
  console.error("Fatal boot error:", e?.message || e);
  process.exit(1);
});
