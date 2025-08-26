// apps/bot/src/lib/telegram.ts
import { Telegraf, Context } from "telegraf";
import { registerStart } from "../commands/start";
import { registerSmartStart } from "../commands/smartStart";
// subjects.ts exports `registerSubjectHandlers` — alias it to registerSubjects
import { registerSubjectHandlers as registerSubjects } from "../commands/subjects";
import { registerStudyActions } from "../commands/studyActions";
import { registerOnboard } from "../commands/onboard";
import { registerDev } from "../commands/dev";

// --- Bot token ---
const TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  process.env.BOT_TOKEN ||
  process.env.TG_BOT_TOKEN;

if (!TOKEN) throw new Error("❌ TELEGRAM_BOT_TOKEN is missing");

// Create a single shared Telegraf instance
export const bot = new Telegraf<Context>(TOKEN, {
  handlerTimeout: 90_000, // avoid long-hanging handlers
});

// Register all features here (one place to rule them all)
registerStart(bot);
registerSmartStart(bot);
registerSubjects(bot);
registerStudyActions(bot);
registerOnboard(bot);
registerDev(bot);

// Optional convenience: launch + graceful shutdown
export async function launchBot() {
  await bot.launch();
  const uname = process.env.NEXT_PUBLIC_TG_BOT_USERNAME || "(unknown)";
  console.log(`🤖 BrainBot launched as @${uname}`);

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

// --- Lightweight fetch-based notifier (useful from webhooks/workers) ---
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
