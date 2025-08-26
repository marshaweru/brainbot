// apps/bot/src/commands/onboard.ts
import { Telegraf, Context, Markup } from "telegraf";
import { getCollections } from "../lib/db";
import { openSubjectPicker } from "./subjects";
import { sendSmartStart } from "./smartStart";
import { minutesPerSession, PLAN_LIMITS, reserveSession, getUserTier } from "../lib/plan";
import { generateSession } from "../lib/session";
import { labelBySlug } from "../data/subjectsCatalog";
import { estimateTokensByChars } from "../utils/tokenBudget";
import { renderMarkdownToPdf } from "../lib/pdf";

/** simple helpers */
const btn = (text: string, data: string) => Markup.button.callback(text, data);
const gradeKb = () =>
  Markup.inlineKeyboard([
    [btn("A", "SET_GRADE:A"), btn("A-", "SET_GRADE:A-"), btn("B+", "SET_GRADE:B+")],
    [btn("B", "SET_GRADE:B"), btn("B-", "SET_GRADE:B-"), btn("C+", "SET_GRADE:C+")],
    [btn("C", "SET_GRADE:C"), btn("C-", "SET_GRADE:C-"), btn("D+", "SET_GRADE:D+")],
    [btn("D", "SET_GRADE:D"), btn("D-", "SET_GRADE:D-")], // no E in UI by design
  ]);

const nextChoicesRow = () =>
  Markup.inlineKeyboard([
    [btn("🇰🇪 Kiswahili", "START_KIS"), btn("🇬🇧 English", "START_ENG")],
    [btn("🔁 Switch Subject", "SWITCH_QUICK")],
  ]);

function pickDefaultLang(code?: string | null): "eng" | "kis" {
  const c = (code || "").toLowerCase();
  return c.startsWith("sw") ? "kis" : "eng";
}

/** Deliver one subject session, respecting plan counters + attach PDF */
async function deliverSession(ctx: Context, slug: "mat" | "eng" | "kis") {
  const pretty = labelBySlug.get(slug) || "Selected Subject";

  // Decide minutes budget ONLY for paid tiers (free = sessions-based; pass 0)
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
      reasonMsg + "\n\n⬆️ *Upgrade to continue today.*",
      { parse_mode: "Markdown" }
    );
    return false;
  }

  // banner
  const hint =
    slug === "mat"
      ? "Quadratics & Graphs (Paper 1 high frequency)"
      : slug === "eng"
      ? "Comprehension + Summary (Paper 1)"
      : "Insha: Hoja vs Riwaya (Paper 1/2)";

  const banner =
    `⭐ *${pretty}* — recommended focus.\n` +
    `Today’s starter: _${hint}_\n\n` +
    `I’ll send examinable notes + a KCSE-style mini-quiz.\n` +
    `When you finish, tap “Mark My Work”.`;
  await ctx.reply(banner, { parse_mode: "Markdown" });

  try {
    const res = await generateSession({ subject: pretty, mode: "quick" } as any);
    const content = res.content?.trim() || "Session ready.";

    // 1) Send the Markdown in chat (read immediately)
    await ctx.reply(content, { parse_mode: "Markdown" });

    // 2) Render take-home PDF and attach
    try {
      const { filePath, filename } = await renderMarkdownToPdf(
        content,
        `${pretty} — KCSE Study Pack`
      );
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
    } catch (e: any) {
      console.error("[pdf] failed:", e?.message || e);
      await ctx.reply("PDF generation was skipped. You can still proceed:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Mark My Work", callback_data: "MARK_UPLOAD" }],
            [{ text: "🔁 Switch Subject", callback_data: "SWITCH_QUICK" }],
          ],
        },
      });
    }

    // 3) naive token accounting (optional)
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
  } catch (e: any) {
    console.error("[onboard.deliverSession] error:", e?.message || e);
    await ctx.reply("Session generation hiccuped. Try again in a moment or switch subject.");
    return false;
  }
}

export function registerOnboard(bot: Telegraf) {
  // /start — handle deep-links first, then fallback to onboarding wizard
  bot.start(async (ctx) => {
    const payload = (ctx as any).startPayload as string | undefined;

    if (payload === "free") {
      const telegramId = ctx.from!.id.toString();
      const { users } = await getCollections();

      await users.updateOne(
        { telegramId },
        {
          $setOnInsert: { telegramId, createdAt: new Date() },
          $set: { "plan.tier": "free", updatedAt: new Date() },
        },
        { upsert: true }
      );

      await ctx.reply(
        `🎁 *Free Starter unlocked:* **2 subjects total**.\n` +
          `We’ll begin with *Mathematics*, then *English* or *Kiswahili* (compulsory subjects).`,
        { parse_mode: "Markdown" }
      );

      // 1) Deliver Math
      const mathOk = await deliverSession(ctx, "mat");

      // 2) Auto-deliver the language session (if Math succeeded and caps allow)
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
            : "Couldn’t start the language session (limit reached). Pick what to do next:",
          nextChoicesRow()
        );
      } else {
        await ctx.reply(
          "Couldn’t start Mathematics (limit reached). Pick a subject to continue:",
          nextChoicesRow()
        );
      }
      return;
    }

    if (payload === "upgrade") {
      await ctx.reply(
        `💳 Upgrade for longer daily study time, more subjects, and professional-style marking.\n` +
          `Open pricing on the site or pick a plan below.`,
        {
          ...Markup.inlineKeyboard([
            [Markup.button.url("🌐 Open Pricing", "https://yourdomain.xyz/pricing")],
            [btn("Lite Pass (KES 69)", "UP_LITE"), btn("Steady Pass (KES 499)", "UP_STEADY")],
            [btn("Serious Prep (KES 2,999)", "UP_SERIOUS"), btn("Club 84 (KES 5,999)", "UP_CLUB")],
          ]),
        }
      );
      return;
    }

    if (payload === "founder") {
      await ctx.reply(
        `🔥 *Founder’s Offer* — *KES 1,499* for 1 month of *Serious Prep* (~50% OFF).\n` +
          `Limited to the *first 100* students. Claim it now.`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.url("Claim Founder", "https://yourdomain.xyz/pricing#founder")],
            [btn("Not now", "CLOSE")],
          ]),
        }
      );
      return;
    }

    // No/unknown payload → original onboarding wizard
    await ctx.reply(
      "👋 Hey! I’m BrainBot, your KCSE study buddy.\n\nWhat level are you at?",
      Markup.inlineKeyboard([
        [btn("KCSE 2025", "SET_YEAR:2025"), btn("KCSE 2026", "SET_YEAR:2026"), btn("KCSE 2027", "SET_YEAR:2027")],
        [btn("Form 1", "SET_FORM:1"), btn("Form 2", "SET_FORM:2"), btn("Form 3", "SET_FORM:3"), btn("Form 4", "SET_FORM:4")],
        [btn("Skip", "SKIP")],
      ])
    );
  });

  // pick KCSE year
  bot.action(/^SET_YEAR:(\d{4})$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const examYear = Number(ctx.match[1]);
    const { users } = await getCollections();
    const telegramId = ctx.from!.id.toString();

    await users.updateOne(
      { telegramId },
      { $set: { "profile.examYear": examYear, updatedAt: new Date() } },
      { upsert: true }
    );

    await ctx.reply(`Nice — set to *KCSE ${examYear}*.\n\nWhat grade are you aiming for in KCSE?`, {
      parse_mode: "Markdown",
      ...gradeKb(),
    });
  });

  // pick Form level
  bot.action(/^SET_FORM:(\d)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const form = Number(ctx.match[1]);
    const { users } = await getCollections();
    const telegramId = ctx.from!.id.toString();

    await users.updateOne(
      { telegramId },
      { $set: { "profile.formLevel": form, updatedAt: new Date() } },
      { upsert: true }
    );

    await ctx.reply(`Locked in *Form ${form}*.\n\nWhat grade are you aiming for by KCSE?`, {
      parse_mode: "Markdown",
      ...gradeKb(),
    });
  });

  // save target grade → ALWAYS open subject picker if user doesn’t have enough subjects yet
  bot.action(/^SET_GRADE:([A-D](?:\+|-)?)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const grade = ctx.match[1];
    const { users } = await getCollections();
    const telegramId = ctx.from!.id.toString();

    await users.updateOne(
      { telegramId },
      { $set: { "profile.targetGrade": grade, updatedAt: new Date() } },
      { upsert: true }
    );

    await ctx.reply("Setup saved ✅");

    const u = await users.findOne({ telegramId }, { projection: { "profile.subjects": 1 } });
    const subjects: string[] = Array.isArray(u?.profile?.subjects) ? u!.profile!.subjects : [];

    if (!subjects || subjects.length < 7) {
      return openSubjectPicker(ctx);
    }
    return sendSmartStart(ctx);
  });

  // skip straight to subjects
  bot.action("SKIP", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    return openSubjectPicker(ctx);
  });

  // quick subject launchers
  bot.action("START_ENG", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await deliverSession(ctx, "eng");
  });

  bot.action("START_KIS", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await deliverSession(ctx, "kis");
  });

  bot.action("SWITCH_QUICK", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    return openSubjectPicker(ctx);
  });

  bot.action(["UP_LITE", "UP_STEADY", "UP_SERIOUS", "UP_CLUB", "CLOSE"], async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
  });
}
