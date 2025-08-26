// apps/bot/src/commands/start.ts
import { Telegraf, Context, Markup } from "telegraf";
import { getCollections } from "../lib/db";
import { minutesPerSession, reserveSession, getUserTier } from "../lib/plan";
import { generateSession } from "../lib/session";
import { labelBySlug } from "../data/subjectsCatalog";
import { estimateTokensByChars } from "../utils/tokenBudget";
import { renderMarkdownToPdf } from "../lib/pdf";

function nextChoicesRow() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🇰🇪 Kiswahili", "START_KIS"), Markup.button.callback("🇬🇧 English", "START_ENG")],
    [Markup.button.callback("🔁 Switch Subject", "SWITCH_QUICK")],
  ]);
}

function pickDefaultLang(code?: string | null): "eng" | "kis" {
  const c = (code || "").toLowerCase();
  return c.startsWith("sw") ? "kis" : "eng";
}

async function deliverSession(ctx: Context, slug: "mat" | "eng" | "kis") {
  const pretty = labelBySlug.get(slug) || "Selected Subject";

  // Free = sessions-based (no minutes); Paid = minutes by tier
  const tier = await getUserTier(ctx);
  const minutes = tier === "free" ? 0 : minutesPerSession(tier);
  const reservation = await reserveSession(ctx, slug, minutes);

  if (!reservation.ok) {
    let reasonMsg = "";
    switch (reservation.reason) {
      case "trial_exhausted":
        reasonMsg = "🎁 You’ve used your *2 free sessions*.";
        break;
      case "subjects":
        reasonMsg = "📚 You’ve reached today’s *subject limit* for your plan.";
        break;
      case "minutes":
      default:
        reasonMsg = "⏳ You’ve used today’s *study time* for your plan.";
        break;
    }
    await ctx.reply(
      reasonMsg + "\n\n⬆️ *Upgrade to continue today* or come back tomorrow.",
      { parse_mode: "Markdown" }
    );
    return false;
  }

  const hint =
    slug === "mat" ? "Quadratics & Graphs (Paper 1 high frequency)" :
    slug === "eng" ? "Comprehension + Summary (Paper 1)" :
                     "Insha: Hoja vs Riwaya (Paper 1/2)";

  const banner =
    `⭐ *${pretty}* — recommended focus.\n` +
    `Today’s starter: _${hint}_\n\n` +
    `I’ll send examinable notes + a KCSE-style mini-quiz.\n` +
    `When you finish, tap “Mark My Work”.`;
  await ctx.reply(banner, { parse_mode: "Markdown" });

  try {
    const res = await generateSession({ subject: pretty, mode: "quick" } as any);
    const content = (res.content?.trim() || "Session ready.");

    // Send content for immediate reading
    await ctx.reply(content, { parse_mode: "Markdown" });

    // PDF handout
    try {
      const { filePath, filename } = await renderMarkdownToPdf(content, `${pretty} — KCSE Study Pack`);
      await ctx.replyWithDocument(
        { source: filePath, filename },
        {
          caption: "⬇️ Download your notes & mini-quiz (PDF). Keep this for revision.",
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Mark My Work", callback_data: "MARK_UPLOAD" }],
              [{ text: "🔁 Switch Subject", callback_data: "SWITCH_QUICK" }],
            ],
          },
        }
      );
    } catch (e) {
      await ctx.reply("PDF generation skipped. You can still proceed:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Mark My Work", callback_data: "MARK_UPLOAD" }],
            [{ text: "🔁 Switch Subject", callback_data: "SWITCH_QUICK" }],
          ],
        },
      });
    }

    // token accounting (optional)
    try {
      const tokens = estimateTokensByChars(content);
      const { usage } = await getCollections();
      const date = new Date().toISOString().slice(0, 10);
      await usage.updateOne(
        { telegramId: String(ctx.from?.id), date },
        { $inc: { tokens }, $set: { updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true }
      );
    } catch {}

    return true;
  } catch (e) {
    await ctx.reply("Session generation hiccuped. Try again in a moment or switch subject.");
    return false;
  }
}

export function registerStart(bot: Telegraf<Context>) {
  const actions: Record<string, (ctx: Context) => Promise<void> | void> = {
    async free(ctx) {
      const telegramId = ctx.from?.id?.toString()!;
      const { users } = await getCollections();
      await users.updateOne(
        { telegramId },
        { $setOnInsert: { telegramId, createdAt: new Date() }, $set: { "plan.tier": "free", updatedAt: new Date() } },
        { upsert: true }
      );

      await ctx.reply(
        `🎁 *Free Starter unlocked:* **2 sessions total**.\n` +
        `We’ll begin with *Mathematics*, then *English* or *Kiswahili* (compulsory subjects).`,
        { parse_mode: "Markdown" }
      );

      const mathOk = await deliverSession(ctx, "mat");
      if (mathOk) {
        const suggested = pickDefaultLang((ctx.from as any)?.language_code);
        await ctx.reply(
          suggested === "kis"
            ? "🇰🇪 Next up automatically: *Kiswahili*."
            : "🇬🇧 Next up automatically: *English*.",
          { parse_mode: "Markdown" }
        );
        const langOk = await deliverSession(ctx, suggested);
        await ctx.reply(
          langOk
            ? "All set for your compulsory sessions today. Want a different subject next?"
            : "Limit reached. Pick what to do next:",
          nextChoicesRow()
        );
      } else {
        await ctx.reply("Couldn’t start Mathematics. Pick a subject to continue:", nextChoicesRow());
      }
    },

    async upgrade(ctx) {
      await ctx.reply(
        `💳 Upgrade for longer daily study time, more subjects, and examiner-style marking.\nOpen pricing on the site or pick a plan below.`,
        {
          ...Markup.inlineKeyboard([
            [Markup.button.url("🌐 Open Pricing", "https://yourdomain.xyz/pricing")],
            [Markup.button.callback("Lite Pass (KES 69)", "UP_LITE"), Markup.button.callback("Steady Pass (KES 499)", "UP_STEADY")],
            [Markup.button.callback("Serious Prep (KES 2,999)", "UP_SERIOUS"), Markup.button.callback("Club 84 (KES 5,999)", "UP_CLUB")],
          ]),
        }
      );
    },

    async founder(ctx) {
      await ctx.reply(
        `🔥 *Founder’s Offer* — *KES 1,499* for 1 month of *Serious Prep* (~50% OFF).\nLimited to the *first 100* students. Claim it now.`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.url("Claim Founder", "https://yourdomain.xyz/pricing#founder")],
            [Markup.button.callback("Not now", "CLOSE")],
          ]),
        }
      );
    },
  };

  // /start
  bot.start(async (ctx) => {
    const payload = (ctx as any).startPayload as string | undefined;
    if (payload && actions[payload]) { await actions[payload](ctx); return; }

    // No payload (user tapped Telegram's default Start)
    const botUser = process.env.NEXT_PUBLIC_TG_BOT_USERNAME || process.env.TELEGRAM_BOT_USERNAME || "";
    await ctx.reply(
      `👋 Welcome to *BrainBot* — KCSE examiner-level study.\nTap below to start your *Free Trial (2 sessions)* or pick subjects.`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [
            Markup.button.url(
              "🚀 Start Free Trial",
              `https://t.me/${botUser}?start=free`
            ),
          ],
          [Markup.button.callback("📚 Pick Subjects", "SWITCH_QUICK")],
        ]),
      }
    );
  });

  // quick actions
  bot.action("START_SESSION", async (ctx) => { await ctx.answerCbQuery(); await deliverSession(ctx, "mat"); });
  bot.action("START_MATH",    async (ctx) => { await ctx.answerCbQuery(); await deliverSession(ctx, "mat"); });
  bot.action("START_ENG",     async (ctx) => { await ctx.answerCbQuery(); await deliverSession(ctx, "eng"); });
  bot.action("START_KIS",     async (ctx) => { await ctx.answerCbQuery(); await deliverSession(ctx, "kis"); });

  bot.action(["UP_LITE","UP_STEADY","UP_SERIOUS","UP_CLUB"], async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
      `✅ I’ll open the pricing page so you can complete payment via M-PESA in Telegram.`,
      Markup.inlineKeyboard([[Markup.button.url("Open Pricing", "https://yourdomain.xyz/pricing")]])
    );
  });

  bot.action("CLOSE", async (ctx) => { await ctx.answerCbQuery(); });
}
