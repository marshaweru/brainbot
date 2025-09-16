import { Telegraf, Context } from "telegraf";
import crypto from "crypto";
import axios from "axios";

const WEB_API = process.env.WEB_API_BASE!;              // e.g. https://your-site.com
const SECRET  = process.env.SESSION_WEBHOOK_SECRET!;

export function registerLinkCommand(bot: Telegraf) {
  bot.command("link", async (ctx: Context) => {
    const text = (ctx.message as any).text as string;
    const code = (text?.split(" ")[1] || "").trim();

    if (!/^\d{6}$/.test(code)) {
      return ctx.reply("Send like this: /link 123456 (6-digit code from the website)");
    }

    const payload = JSON.stringify({
      code,
      telegramId: ctx.from!.id,
    });

    const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");

    try {
      const res = await axios.post(`${WEB_API}/api/link/claim`, payload, {
        headers: {
          "Content-Type": "application/json",
          "x-brainbot-signature": sig,
        },
        timeout: 8000,
      });

      if (res.data?.ok || res.data?.already) {
        return ctx.reply("✅ Linked! Head back to the website and open your Dashboard.");
      }
      return ctx.reply("❌ That code is invalid or expired. Generate a new one on the website.");
    } catch (e) {
      return ctx.reply("⚠️ Couldn’t link right now. Please try again.");
    }
  });
}
