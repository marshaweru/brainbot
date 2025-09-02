import { Telegraf } from "telegraf";
import type { Context } from "telegraf";

import { registerSmartStart } from "../commands/smartStart.js";
import { registerSubjectHandlers as registerSubjects } from "../commands/subjects.js";
import { registerStudyActions } from "../commands/studyActions.js";
import { registerOnboard } from "../commands/onboard.js";
import { registerDev } from "../commands/dev.js";
import { registerVoice } from "../voice.js";            // ⬅️ correct path
import { registerStudy } from "../commands/study.js";

const TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  process.env.BOT_TOKEN ||
  process.env.TG_BOT_TOKEN;

if (!TOKEN) throw new Error("❌ TELEGRAM_BOT_TOKEN is missing");

export const bot: Telegraf<Context> = new Telegraf<Context>(TOKEN, {
  handlerTimeout: 90_000,
});

// Register features
registerSmartStart(bot);
registerSubjects(bot);
registerStudyActions(bot);
registerOnboard(bot);
registerDev(bot);
registerVoice(bot);
registerStudy(bot); // ✅ /study wired here

bot.catch((err, ctx) => {
  console.error("Telegraf error for", ctx.updateType, err);
});

export async function launchBot() {
  await bot.launch();
  const uname =
    process.env.NEXT_PUBLIC_TG_BOT_USERNAME ||
    process.env.TELEGRAM_BOT_USERNAME ||
    "(unknown)";
  console.log(`🤖 BrainBot launched as @${uname}`);

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  opts?: { parseMode?: "Markdown" | "HTML" | "MarkdownV2" }
): Promise<void> {
  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: opts?.parseMode || "Markdown",
    disable_web_page_preview: true,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`Telegram sendMessage failed: ${res.status} ${body}`);
    }
  } catch (e) {
    console.error("Telegram send error:", e);
  }
}
