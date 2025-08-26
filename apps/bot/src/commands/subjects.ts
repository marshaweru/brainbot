// apps/bot/src/commands/subjects.ts
import { Telegraf } from "telegraf";
import { claimFreeSubject, FREE_SUBJECT_LIMIT } from "../lib/free";
import { hasActivePlanByTelegramId } from "../lib/plan";
import { sendSmartStart } from "./smartStart";

// Keep context loose to avoid Telegraf typing mismatches
type Ctx = any;

const TG_BOT =
  process.env.TG_BOT_USERNAME ||
  process.env.NEXT_PUBLIC_TG_BOT_USERNAME ||
  "<your_bot_username>";
const tg = (path = "upgrade") => `https://t.me/${TG_BOT}?start=${path}`;

// Use a helper named `say` (NOT `reply`) so TS never treats it like a tagged template
const say = (ctx: Ctx, text: string, extra?: any) =>
  (ctx as any).reply(text, extra as any);

function pretty(slug: string) {
  switch (slug) {
    case "mat": return "Mathematics";
    case "eng": return "English";
    case "kis": return "Kiswahili";
    default:    return slug;
  }
}

/** Inline keyboard for compulsory subjects */
export function openSubjectPicker(ctx: Ctx, prompt?: string) {
  const kb = {
    inline_keyboard: [[
      { text: "🇰🇪 Kiswahili", callback_data: "pick:kis" },
      { text: "🇬🇧 English",   callback_data: "pick:eng" },
    ]],
  };
  return say(ctx, prompt ?? "Choose your next compulsory subject:", { reply_markup: kb });
}

/**
 * Wrapper: call sendSmartStart with a subject while silencing the TS arity complaint.
 * (If you later update ./smartStart typings to accept the second arg, you can remove this.)
 */
const smartStart = (ctx: Ctx, subjectSlug: "mat" | "eng" | "kis") =>
  (sendSmartStart as unknown as (c: Ctx, s?: "mat" | "eng" | "kis") => Promise<any>)(ctx, subjectSlug);

/** Centralized start with free-gate (2 unique subjects total) */
async function startWithFreeGate(ctx: Ctx, subjectSlug: "mat" | "eng" | "kis") {
  const telegramId = String(ctx.from?.id ?? "");
  if (!telegramId) return;

  // Paid users bypass the free trial
  if (await hasActivePlanByTelegramId(telegramId)) {
    await smartStart(ctx, subjectSlug);
    return;
  }

  // Claim a unique free subject (idempotent)
  const { atLimit, remaining } = await claimFreeSubject(telegramId, subjectSlug);

  if (atLimit && remaining === 0) {
    await say(
      ctx,
      `🎁 You’ve used your **${FREE_SUBJECT_LIMIT} free subjects**.\n` +
        `⬆️ **Upgrade** to continue.`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "Upgrade in Telegram", url: tg("upgrade") }]],
        },
      }
    );
    return;
  }

  // Start the subject
  await smartStart(ctx, subjectSlug);

  const msg =
    remaining > 0
      ? `✅ Started **${pretty(subjectSlug)}**. You have **${remaining}** free subject${remaining === 1 ? "" : "s"} left.`
      : `✅ Started **${pretty(subjectSlug)}**. That was your last free subject. ⬆️ **Upgrade** to keep going.`;

  await say(ctx, msg, { parse_mode: "Markdown" });
}

/** Register action handlers for subject picks */
export function registerSubjectHandlers(bot: Telegraf) {
  bot.action("pick:mat", async (ctx: Ctx) => {
    try { await startWithFreeGate(ctx, "mat"); } finally { await ctx.answerCbQuery(); }
  });
  bot.action("pick:eng", async (ctx: Ctx) => {
    try { await startWithFreeGate(ctx, "eng"); } finally { await ctx.answerCbQuery(); }
  });
  bot.action("pick:kis", async (ctx: Ctx) => {
    try { await startWithFreeGate(ctx, "kis"); } finally { await ctx.answerCbQuery(); }
  });
}

/** Convenience starter (for other commands) */
export async function startSubject(ctx: Ctx, subjectSlug: "mat" | "eng" | "kis") {
  return startWithFreeGate(ctx, subjectSlug);
}
