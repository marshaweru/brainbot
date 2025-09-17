// apps/bot/src/handlers/start.ts
import { Telegraf, Context } from "telegraf";
import { confirmLinkOnWeb } from "../services/confirmLink";

const DASHBOARD_URL = process.env.WEB_DASHBOARD_URL || "https://your-web-host/dashboard";

/**
 * Helper to parse deep-link payloads:
 * - "st_<jwt>" → JWT start token
 * - Otherwise returns null
 */
function extractStartToken(ctx: Context): string | null {
  // Telegraf exposes start payload via ctx.startPayload for deep links
  const payload = (ctx as any).startPayload as string | undefined;
  if (payload && payload.startsWith("st_")) return payload;

  // Fallback for manual /start st_<token>
  const text = (ctx.message as any)?.text || "";
  const parts = text.split(" ").filter(Boolean);
  if (parts.length >= 2 && parts[1].startsWith("st_")) return parts[1];

  return null;
}

export function registerStart(bot: Telegraf) {
  bot.start(async (ctx) => {
    const token = extractStartToken(ctx);
    const tid = Number(ctx.from?.id);
    const name = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ");

    // No token case
    if (!token) {
      return ctx.reply(
        `👋 Hi ${name || "there"}!\nUse the website to start a session and auto-link, or type /session to begin right here.`
      );
    }

    try {
      const result = await confirmLinkOnWeb(token, tid);

      if (result.ok) {
        if (result.already) {
          await ctx.reply("✅ Already linked — welcome back!");
        } else {
          await ctx.reply("✅ Linked successfully! You can now upload your answers and type /finish when done.");
        }

        // Optional dashboard link
        await ctx.reply(
          `Open your dashboard here:\n${DASHBOARD_URL}`,
          { disable_web_page_preview: true }
        );
      } else {
        await ctx.reply(
          "❌ Couldn’t verify your link. Open the website and generate a fresh link."
        );
      }
    } catch (err: any) {
      const msg = String(err?.message || err);
      await ctx.reply(
        `⚠️ Linking failed: ${msg}\nGenerate a new link from the website and try again.`
      );
    }
  });
}
