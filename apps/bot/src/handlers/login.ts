// apps/bot/src/handlers/login.ts
import type { Context } from "telegraf";
import { Telegraf } from "telegraf";
import { signHS256 } from "../utils/jwt.js";

const WEB_APP_URL = process.env.WEB_APP_URL || "";   // e.g. https://brainbot-web-staging.onrender.com
const JWT_SECRET  = process.env.JWT_SECRET  || "";   // long random string
const ISSUER      = process.env.JWT_ISS || "brainbot";
const AUDIENCE    = process.env.JWT_AUD || "brainbot-web";

function minutesToTtl(mins?: string | number, fallbackSec = 3600): number {
  const n = Number(mins);
  if (!Number.isFinite(n) || n <= 0) return fallbackSec;
  return Math.max(60, Math.min(24 * 3600, Math.round(n * 60))); // clamp 1m..24h
}

/**
 * /login [minutes] [path?]
 * examples:
 *   /login                -> 60 min token, redirect to /
 *   /login 15             -> 15 min token, redirect to /
 *   /login 30 /dashboard  -> 30 min token, redirect to /dashboard
 */
export function registerLogin(bot: Telegraf): void {
  bot.command("login", async (ctx: Context) => {
    try {
      if (!WEB_APP_URL) {
        await ctx.reply("❌ WEB_APP_URL not configured. Ask admin.");
        return;
      }
      if (!JWT_SECRET) {
        await ctx.reply("❌ JWT_SECRET not configured. Ask admin.");
        return;
      }

      const userId = String(ctx.from?.id ?? "");
      if (!userId) {
        await ctx.reply("❌ Couldn’t read your Telegram ID.");
        return;
      }

      const text = (ctx.message as any)?.text ?? "";
      const args = text.replace(/^\/login(@\w+)?\s*/i, "").trim().split(/\s+/).filter(Boolean);

      const ttl = minutesToTtl(args[0], 3600); // default 60 min
      const redirectPath = args[1] && args[1].startsWith("/") ? args[1] : "/";

      // mint JWT (HS256) with exp/iat baked in
      const token = signHS256(
        { sub: userId, role: "user", iss: ISSUER, aud: AUDIENCE },
        JWT_SECRET,
        ttl
      );

      // Build URL: <WEB_APP_URL>/api/auth/login?token=...&redirect=/foo
      const url = new URL(WEB_APP_URL);
      url.pathname = "/api/auth/login";
      url.searchParams.set("token", token);
      url.searchParams.set("redirect", redirectPath);

      await ctx.reply(
        `🔐 Login link (valid ${(ttl / 60) | 0} min):\n${url.toString()}\n\n` +
        `Don’t share this link. It’s tied to your account.`,
        { link_preview_options: { is_disabled: true } } as any
      );
    } catch (err: any) {
      await ctx.reply(`Couldn’t generate a login link: ${err?.message ?? "unknown error"}`);
    }
  });
}
