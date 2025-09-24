// apps/bot/src/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import { Telegraf, Markup } from "telegraf";
import { message } from "telegraf/filters";

import { registerStart } from "./handlers/start.js";                  // /start st_<jwt> or drill_<topic>
import { registerSessionStart } from "./handlers/session-start.js";   // /session + subject pick + timers + paper
import { registerUploads } from "./handlers/uploads.js";              // photo/voice/document/text with window rules
import { registerSessionFinish } from "./handlers/session-finish.js"; // /finish → marking + feedback + pdf + notes/drills
import { registerRemark } from "./handlers/remark.js";                // /remark <sessionId> (re-mark past session)
import { registerExportPdf } from "./handlers/export-pdf.js";         // /pdf
import { registerNotesHandlers } from "./handlers/notes.js";          // /notes
import { registerDrillHandlers } from "./handlers/drills.js";                  // /drill + deep-link drill_<topic>
import { registerStatsHandlers } from "./handlers/stats.js";          // /stats
import { registerInsightsHandlers } from "./handlers/insights.js";    // /insights

import { planFromAmount } from "./repo/planRepo.js";
import { stkPush, toMSISDN } from "./lib/mpesa.js";
import { notifyAdmin } from "./lib/notify.js";
import { watchUploadCleaner } from "./services/upload-cleaner.js";

import { connectMongo } from "./db/mongo.js";
import { SessionModel } from "./models/Session.js";

// MPESA routes (Express)
import { router as stkInitiateRouter } from "./routes/mpesa/stk-initiate.js";
import { router as c2bConfirmRouter } from "./routes/mpesa/c2b-confirmation.js";

// ----------------- Env & Mode -----------------
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("❌ TELEGRAM_BOT_TOKEN is not set");

const MODE = (process.env.BOT_MODE ?? "polling").toLowerCase() as "polling" | "webhook";
const PUBLIC_URL = process.env.PUBLIC_URL; // required in webhook mode
const WEBHOOK_PATH = process.env.WEBHOOK_PATH ?? "/bot/webhook";

const PORT = Number(process.env.PORT || process.env.BOT_PORT || 8080);

// ----------------- Helpers -----------------
function swallow<T>(p: Promise<T>) {
  return p.catch((e: any) => {
    console.warn("[bot] non-fatal:", e?.code || e?.message || e);
    return null as any;
  });
}

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ----------------- Telegraf Bot -----------------
const bot = new Telegraf(BOT_TOKEN);

bot.catch((err, ctx) => {
  console.error("❌ Bot error for update", ctx?.update?.update_id, err);
});

// Core handlers
registerStart(bot);
registerSessionStart(bot);
registerUploads(bot);
registerSessionFinish(bot);
registerRemark(bot);
registerExportPdf(bot);
registerNotesHandlers(bot);
registerDrillHandlers(bot); // ✅ new drill flow (command + deep-link)
registerStatsHandlers(bot);
registerInsightsHandlers(bot);

// ----------------- Payments / Upgrade UX (Bot-side) -----------------
const pendingCheckout = new Map<string, { amount: number; tier: string; at: number }>();

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
    await notifyAdmin(
      `⚠️ Unknown pricing button pressed\n<b>User:</b> ${ctx.from?.id}\n<b>Amount:</b> KES ${amount}`
    );
    return;
  }
  const tier = map.tier;
  const uid = String(ctx.from?.id ?? "");

  pendingCheckout.set(uid, { amount, tier, at: Date.now() });

  await ctx.answerCbQuery();
  await ctx.replyWithHTML(
    `You chose <b>${tier}</b> — KES <b>${amount.toLocaleString()}</b>.

Tap the button below to share your M-PESA number (recommended), or type it here in the format 07XXXXXXXX.`,
    Markup.keyboard([
      [Markup.button.contactRequest("📱 Share my M-PESA number")],
      [Markup.button.text("Cancel")],
    ])
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
    await stkPush({
      amount: pend.amount,
      phone,
      accountRef: uid,
      description: `BrainBot ${pend.tier}`,
    });
    await ctx.replyWithHTML(`✅ STK sent to <b>${phone}</b>. Approve on your phone.`);
  } catch (e: any) {
    const msg = e?.response?.data ? JSON.stringify(e.response.data) : String(e);
    console.error("stkPush error:", msg);
    await ctx.reply(
      "❌ Could not send STK. Check your number and try again, or use Paybill 4168557 manually."
    );
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
      await stkPush({
        amount: pend.amount,
        phone,
        accountRef: uid,
        description: `BrainBot ${pend.tier}`,
      });
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

// ----------------- Express (health + M-PESA + optional webhook) -----------------
const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.set("trust proxy", true);

// Health
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// MPESA endpoints
app.use("/mpesa/stk-initiate", stkInitiateRouter);
app.use("/mpesa/c2b-confirmation", c2bConfirmRouter);

// If running in webhook mode, attach Telegram webhook handler
app.post(WEBHOOK_PATH, express.json(), (req, res) => {
  bot.handleUpdate(req.body, res).catch((err) => {
    console.error("Webhook error:", err);
    res.sendStatus(500);
  });
});

// ----------------- Bootstrap -----------------
(async () => {
  try {
    await connectMongo();

    // indexes (safe/settled to avoid crashing if already exist)
    await Promise.allSettled([SessionModel.syncIndexes()]);

    const me = await bot.telegram.getMe();
    console.log(`🔑 Auth OK: @${me.username} (id ${me.id})`);

    // cleaner after DB is ready
    watchUploadCleaner();

    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`🌐 HTTP server listening on :${PORT}`);
      console.log(`   • GET  /healthz`);
      console.log(`   • POST /mpesa/stk-initiate`);
      console.log(`   • POST /mpesa/c2b-confirmation`);
      if (MODE === "webhook") {
        console.log(`   • POST ${WEBHOOK_PATH} (Telegram webhook)`);
      }
    });

    if (MODE === "polling") {
      // Local: network to api.telegram.org can be flaky → swallow timeouts
      await swallow(bot.telegram.deleteWebhook({ drop_pending_updates: true }));
      await bot.launch();
      console.log("🚀 BrainBot Telegram bot running (long-polling)!");
    } else {
      // Render/webhook mode
      await swallow(
        bot.telegram.setWebhook(`${PUBLIC_URL}${WEBHOOK_PATH}`, {
          secret_token: process.env.TG_SECRET,
        })
      );
      console.log("🚀 BrainBot Telegram bot running (webhook)!");
    }
  } catch (err) {
    console.error("💥 startup error:", err);
  }
})();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
