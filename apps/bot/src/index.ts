// apps/bot/src/index.ts
import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";

import { Telegraf, Markup } from "telegraf";
import { message } from "telegraf/filters";

import { registerLogin } from "./handlers/login.js";
import { registerStart } from "./handlers/start.js";
import { registerSessionStart } from "./handlers/session-start.js";
import { registerUploads } from "./handlers/uploads.js";
import { registerSessionFinish } from "./handlers/session-finish.js";
import { registerRemark } from "./handlers/remark.js";
import { registerExportPdf } from "./handlers/export-pdf.js";
import { registerNotesHandlers } from "./handlers/notes.js";
import { registerDrillHandlers } from "./handlers/drills.js";
import { registerStatsHandlers } from "./handlers/stats.js";
import { registerAdminInsights } from "./handlers/admin-insights.js";
import { registerProgressHandlers } from "./handlers/progress.js";
import { registerLessonPlan } from "./handlers/lesson-plan.js";
import { registerInsights } from "./handlers/insights.js";
import { registerMark } from "./handlers/mark.js";
import { registerFeedback } from "./handlers/feedback.js";

import { planFromAmount } from "./repo/planRepo.js";
import { stkPush, toMSISDN } from "./lib/mpesa.js";
import { notifyAdmin } from "./lib/notify.js";
import { watchUploadCleaner } from "./services/upload-cleaner.js";

import { connectMongo, wireMongoShutdownSignals, closeMongo } from "./db/mongo.js";

// MPESA routes (Express)
import { router as stkInitiateRouter } from "./routes/mpesa/stk-initiate.js";
import { router as c2bConfirmRouter } from "./routes/mpesa/c2b-confirmation.js";

/* ----------------- Env & Mode ----------------- */
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MODE = (process.env.BOT_MODE ?? "polling").toLowerCase() as "polling" | "webhook";
const PUBLIC_URL = process.env.PUBLIC_URL;
const WEBHOOK_PATH = process.env.WEBHOOK_PATH ?? "/bot/webhook";
const PORT = Number(process.env.PORT || process.env.BOT_PORT || 8080);
const TG_SECRET = process.env.TG_SECRET;

/* minimal env guard */
(function assertEnv() {
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is required");
  if (MODE === "webhook" && !PUBLIC_URL) throw new Error("PUBLIC_URL is required in webhook mode");
  if (MODE === "webhook" && !TG_SECRET) console.warn("⚠️ TG_SECRET not set; webhook will be less secure");
})();

/* ----------------- Helpers ----------------- */
function swallow<T>(p: Promise<T>) {
  return p.catch((e: any) => {
    console.warn("[bot] non-fatal:", e?.code || e?.message || e);
    return null as any;
  });
}
const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** tiny per-IP rate limit (burst N / window) with TTL sweep */
function rateLimit({ limit = 5, windowMs = 60_000 } = {}) {
  const hits = new Map<string, { c: number; t: number }>();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [ip, rec] of hits) if (now - rec.t > windowMs) hits.delete(ip);
  }, Math.max(10_000, Math.floor(windowMs / 3)));
  sweep.unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = (req.ip || req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "unknown")
      .toString()
      .split(",")[0]
      .trim();
    const rec = hits.get(ip);
    if (!rec || now - rec.t > windowMs) {
      hits.set(ip, { c: 1, t: now });
      return next();
    }
    if (rec.c >= limit) return res.status(429).json({ ok: false, error: "Too many requests" });
    rec.c++;
    next();
  };
}

/** TTL sweeper for arbitrary maps */
function installTTLMapSweep<K, V extends { at: number }>(map: Map<K, V>, ttlMs: number, sweepMs = 60_000) {
  const h = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of map) if (now - v.at > ttlMs) map.delete(k);
  }, sweepMs);
  h.unref?.();
}

/* ----------------- Telegraf Bot ----------------- */
const bot = new Telegraf(BOT_TOKEN!);
bot.catch((err, ctx) => {
  console.error("Bot error:", { update: ctx?.update?.update_id, msg: (err as any)?.message });
});

/* Core handlers */
registerLogin(bot);
registerStart(bot);
registerSessionStart(bot);
registerUploads(bot);
registerSessionFinish(bot);
registerRemark(bot);
registerExportPdf(bot);
registerNotesHandlers(bot);
registerDrillHandlers(bot);
registerStatsHandlers(bot);
registerAdminInsights(bot);
registerProgressHandlers(bot);
registerLessonPlan(bot); // ← keep only one
registerInsights(bot);
registerMark(bot);
registerFeedback(bot);

/* ----------------- Payments / Upgrade UX (Bot-side) ----------------- */
const pendingCheckout = new Map<string, { amount: number; tier: string; at: number }>();
installTTLMapSweep(pendingCheckout, 10 * 60_000); // expire pending cart after 10 minutes

bot.command("upgrade", async (ctx) => {
  const kb = Markup.inlineKeyboard([
    [Markup.button.callback("Get Lite — KES 69", "buy:69")],
    [Markup.button.callback("Get Steady — KES 499", "buy:499")],
    [Markup.button.callback("Get Serious — KES 2,999", "buy:2999")],
    [Markup.button.callback("Get Limited — KES 1,499", "buy:1499")],
    [Markup.button.callback("Go Elite — KES 5,999", "buy:5999")],
  ]);
  await ctx.replyWithHTML(
    `<b>Choose a plan and pay via M-PESA (STK push)</b>
Paybill <b>4168557</b> • Ref = your Telegram ID`,
    kb
  );
});

bot.action(/^buy:(\d+)$/, async (ctx) => {
  const amount = Number(ctx.match[1]);
  const map = planFromAmount(amount);
  if (!map) {
    await ctx.answerCbQuery("Unknown amount. Ping support.");
    await notifyAdmin(`⚠️ Unknown pricing button pressed\n<b>User:</b> ${ctx.from?.id}\n<b>Amount:</b> KES ${amount}`);
    return;
  }
  const tier = map.tier;
  const uid = String(ctx.from?.id ?? "");
  pendingCheckout.set(uid, { amount, tier, at: Date.now() });

  await ctx.answerCbQuery();
  await ctx.replyWithHTML(
    `You chose <b>${tier}</b> — KES <b>${amount.toLocaleString()}</b>.
Tap the button below to share your M-PESA number (recommended), or type it here in the format 07XXXXXXXX.`,
    Markup.keyboard([[Markup.button.contactRequest("📱 Share my M-PESA number")], [Markup.button.text("Cancel")]])
      .oneTime()
      .resize()
  );
});

// Contact → STK push
bot.on(message("contact"), async (ctx) => {
  const uid = String(ctx.from?.id ?? "");
  const pend = pendingCheckout.get(uid);
  if (!pend) return;

  const raw = (ctx.message as any).contact?.phone_number as string | undefined;
  if (!raw) return;

  let phone: string;
  try {
    phone = toMSISDN(raw);
  } catch {
    await ctx.reply("❌ That phone number looks invalid. Try again.");
    await notifyAdmin(`⚠️ Invalid phone from user\n<b>User:</b> ${uid}\n<b>Raw:</b> ${raw}`);
    return;
  }

  await ctx.reply("⚡ Sending STK push…", Markup.removeKeyboard());

  try {
    await stkPush({ amount: pend.amount, phone, accountRef: uid, description: `BrainBot ${pend.tier}` });
    await ctx.replyWithHTML(`✅ STK sent to <b>${phone}</b>. Approve on your phone.`);
  } catch (e: any) {
    const msg = e?.response?.data ? JSON.stringify(e.response.data) : String(e);
    console.error("stkPush error:", msg);
    await ctx.reply("❌ Could not send STK. Check your number and try again, or use Paybill 4168557 manually.");
    await notifyAdmin(
      `💥 STK push FAILED\n<b>User:</b> ${uid}\n<b>Amount:</b> KES ${pend.amount}\n<b>Phone:</b> ${phone}\n<pre>${escHtml(
        msg
      ).slice(0, 2000)}</pre>`
    );
  } finally {
    pendingCheckout.delete(uid);
  }
});

// Text: typed phone while mid-checkout
bot.on(message("text"), async (ctx, next) => {
  const uid = String(ctx.from?.id ?? "");
  const text = (ctx.message as any).text?.trim() ?? "";
  const pend = pendingCheckout.get(uid);

  if (pend && /^(\+?254|0|7)\d{8,9}$/.test(text)) {
    let phone: string;
    try {
      phone = toMSISDN(text);
    } catch {
      await ctx.reply("❌ That phone number looks invalid. Try again.");
      await notifyAdmin(`⚠️ Invalid typed phone\n<b>User:</b> ${uid}\n<b>Raw:</b> ${text}`);
      return;
    }

    await ctx.reply("⚡ Sending STK push…", Markup.removeKeyboard());
    try {
      await stkPush({ amount: pend.amount, phone, accountRef: uid, description: `BrainBot ${pend.tier}` });
      await ctx.replyWithHTML(`✅ STK sent to <b>${phone}</b>. Approve on your phone.`);
    } catch (e: any) {
      const msg = e?.response?.data ? JSON.stringify(e.response.data) : String(e);
      console.error("stkPush error:", msg);
      await ctx.reply("❌ Could not send STK. Try again or pay to 4168557.");
      await notifyAdmin(
        `💥 STK push FAILED (typed)\n<b>User:</b> ${uid}\n<b>Amount:</b> ${pend.amount}\n<b>Phone:</b> ${phone}\n<pre>${escHtml(
          msg
        ).slice(0, 2000)}</pre>`
      );
    } finally {
      pendingCheckout.delete(uid);
    }
    return;
  }

  return next();
});

/* ----------------- Express (health + M-PESA + optional webhook) ----------------- */
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

// minimal access log (skip health noise)
app.use((req, _res, next) => {
  if (req.path.startsWith("/healthz")) return next();
  console.log(`${req.method} ${req.path} :: ip=${req.ip}`);
  next();
});

// Health
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// M-PESA endpoints (rate-limited)
const mpesaLimiter = rateLimit({ limit: 5, windowMs: 60_000 });
app.use("/mpesa/stk-initiate", mpesaLimiter, stkInitiateRouter);
app.use("/mpesa/c2b-confirmation", mpesaLimiter, c2bConfirmRouter);

// Telegram webhook (webhook mode)
if (MODE === "webhook") {
  const checkTelegramSecret: express.RequestHandler = (req, res, next) => {
    if (!TG_SECRET) return next(); // already warned; allow if unset
    const got = req.header("x-telegram-bot-api-secret-token");
    if (got !== TG_SECRET) return res.status(403).json({ ok: false, error: "Bad secret" });
    next();
  };
  const webhook = bot.webhookCallback(WEBHOOK_PATH);
  app.post(WEBHOOK_PATH, checkTelegramSecret, (req, res) => {
    webhook(req, res, (err?: unknown) => {
      if (err) {
        console.error("Webhook error:", (err as any)?.message || err);
        res.sendStatus(500);
      }
      // else Telegraf already responded 200
    });
  });
}

/* ----------------- Bootstrap ----------------- */
(async () => {
  try {
    await connectMongo();
    wireMongoShutdownSignals();

    const me = await bot.telegram.getMe();
    console.log(`🔑 Auth OK: @${me.username} (id ${me.id})`);

    watchUploadCleaner();

    const server = app.listen(PORT, () => {
      console.log(`🌐 HTTP server listening on :${PORT}`);
      console.log(`   • GET  /healthz`);
      console.log(`   • POST /mpesa/stk-initiate`);
      console.log(`   • POST /mpesa/c2b-confirmation`);
      if (MODE === "webhook") console.log(`   • POST ${WEBHOOK_PATH} (Telegram webhook)`);
    });

    if (MODE === "polling") {
      await swallow(bot.telegram.deleteWebhook({ drop_pending_updates: true }));
      await bot.launch();
      console.log("🚀 BrainBot Telegram bot running (long-polling)!");
    } else {
      await swallow(
        bot.telegram.setWebhook(`${PUBLIC_URL}${WEBHOOK_PATH}`, {
          secret_token: TG_SECRET,
        })
      );
      console.log("🚀 BrainBot Telegram bot running (webhook)!");
    }

    // graceful shutdown for bot + HTTP + Mongo
    const stop = async (sig: NodeJS.Signals) => {
      try {
        console.log(`\n⛔ ${sig} received`);
        await bot.stop(sig);
        await new Promise<void>((r) => server.close(() => r()));
        await closeMongo();
      } finally {
        process.exit(0);
      }
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  } catch (err) {
    console.error("💥 startup error:", (err as any)?.message || err);
    process.exit(1);
  }
})();
