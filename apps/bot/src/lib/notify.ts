// apps/bot/src/lib/notify.ts
// Minimal Telegram DM helper for admin alerts.

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ADMIN_ID = (process.env.ADMIN_TELEGRAM_ID || "7959124324").trim(); // your ID as fallback

export async function notifyAdmin(text: string) {
  try {
    if (!BOT_TOKEN || !ADMIN_ID) return;
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    } as any);
  } catch (err) {
    console.error("notifyAdmin failed:", err);
  }
}
