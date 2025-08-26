// apps/bot/src/index.ts
import "dotenv/config";
import express from "express";
import { Context } from "telegraf";

import { connectDB } from "./lib/db";
import { router as mpesaRouter } from "./routes/mpesa/c2b-confirmation";

import studyCmd from "./commands/study";
import meCmd from "./commands/me";
import { registerVoice } from "./voice";            // keep voice here (not in lib/telegram)
import { bot, launchBot } from "./lib/telegram";    // bot is pre-wired with start/smartStart/subjects/studyActions/onboard/dev

// PORT with sane fallback
const PORT =
  process.env.PORT && process.env.PORT.trim() !== ""
    ? parseInt(process.env.PORT, 10)
    : 8787;

// Log every update (useful in dev)
bot.use(async (ctx: Context, next) => {
  console.log(
    "▶ update:",
    ctx.updateType,
    "from",
    ctx.from?.id,
    ctx.from?.username || ctx.from?.first_name
  );
  return next();
});

// Register only what's NOT wired in lib/telegram.ts
registerVoice(bot);
bot.command("study", studyCmd);
bot.command("me", meCmd);

// Central error trap
bot.catch((err: unknown) => {
  const msg = (err as any)?.message ?? String(err);
  console.error("🤖 Bot error:", msg);
});

// ── Express ────────────────────────────────────────────────────────────
const app = express();

// Behind proxy/CDN? Let req.ip reflect X-Forwarded-For
app.set("trust proxy", 1);

// Accept JSON + urlencoded (some gateways can send form bodies)
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.get("/", (_req, res) => res.send("BrainBot API OK"));
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/health/db", async (_req, res) => {
  try {
    const db = await connectDB();
    await db.command({ ping: 1 });
    res.json({ ok: true, db: db.databaseName });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});
app.get("/health/bot", async (_req, res) => {
  try {
    const me = await bot.telegram.getMe();
    res.json({ ok: true, bot: me.username });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// M-PESA webhook
app.use("/api/mpesa/c2b/confirmation", mpesaRouter);

app.listen(PORT, async () => {
  console.log(`🌐 Express on http://localhost:${PORT}`);

  try {
    await connectDB();
    console.log("🧠 DB ready at startup");
  } catch (e: any) {
    console.error("❌ DB connect failed at startup:", e?.message || e);
  }

  // Cleanly switch to polling if a webhook exists (prevents 409)
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log("🧹 Webhook deleted, switching to polling");
  } catch (e: any) {
    console.error("Webhook delete failed:", e?.message || e);
  }

  await launchBot();
  console.log("🤖 Bot launched (polling)");
});

// graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
