// apps/bot/src/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import { Telegraf, Markup } from "telegraf";
import { message } from "telegraf/filters";

import { registerStart } from "./handlers/start";                  // /start st_<jwt> (JWT link)
import { registerSessionStart } from "./handlers/session-start";   // /session + subject pick + timers + paper
import { registerUploads } from "./handlers/uploads";              // photo/voice/document/text with window rules
import { registerSessionFinish } from "./handlers/session-finish"; // /finish → marking + feedback + pdf + notes/drills
import { registerRemark } from "./handlers/remark";                // /remark <sessionId> (re-mark past session)
import { registerExportPdf } from "./handlers/export-pdf";         // /pdf
import { registerNotesHandlers } from "./handlers/notes";          // /notes
import { registerDrillHandlers } from "./handlers/drills";         // /drill
import { registerStatsHandlers } from "./handlers/stats";          // /stats
import { registerInsightsHandlers } from "./handlers/insights";    // /insights

import { planFromAmount } from "./repo/planRepo";
import { stkPush, toMSISDN } from "./lib/mpesa";
import { notifyAdmin } from "./lib/notify";
import { watchUploadCleaner } from "./services/upload-cleaner";

import { connectMongo } from "./db/mongo";
import { SessionModel } from "./models/Session";

// --- NEW: MPESA routes (Express) ------------------------------------------
import { router as stkInitiateRouter } from "./routes/mpesa/stk-initiate";
import { router as c2bConfirmRouter } from "./routes/mpesa/c2b-confirmation";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("❌ TELEGRAM_BOT_TOKEN is not set");

// Optional: server port for Express
const PORT = Number(process.env.PORT || process.env.BOT_PORT || 8080);

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
registerDrillHandlers(bot);
registerStatsHandlers(bot);
registerInsightsHandlers(bot);

// ----------------- Payments / Upgrade UX (Bot-side) -----------------
const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// who’s mid-checkout (amount/tier) waiting to share phone or type it
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

// Text: handle typed phone ONLY when mid-checkout; otherwise let other handlers run
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

  // Not a checkout phone → allow other handlers to process:
  return next();
});

// ----------------- Express Server (for MPESA) -----------------
const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

// Health
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// Mount MPESA routes
app.use("/mpesa/stk-initiate", stkInitiateRouter);
app.use("/mpesa/c2b-confirmation", c2bConfirmRouter);

// ----------------- Bootstrap -----------------
(async () => {
  try {
    await connectMongo();

    // Rely on schema-defined indexes only (prevents IndexOptionsConflict)
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await Promise.allSettled([SessionModel.syncIndexes()]);

    const me = await bot.telegram.getMe();
    console.log(`🔑 Auth OK: @${me.username} (id ${me.id})`);

    // start cleaner AFTER DB is ready, BEFORE launch
    watchUploadCleaner();

    // Start express server
    app.listen(PORT, () => {
      console.log(`🌐 HTTP server listening on :${PORT}`);
      console.log(`   • POST /mpesa/stk-initiate   (protected by SERVICE_TOKEN)`);
      console.log(`   • POST /mpesa/c2b-confirmation (Daraja callback)`);
    });

    // Start bot long polling
    await bot.launch();
    console.log("🚀 BrainBot Telegram bot running! Listening for updates…");
  } catch (err) {
    console.error("💥 startup error:", err);
  }
})();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
