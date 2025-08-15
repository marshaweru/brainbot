const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
export async function sendTelegramMessage(chatId: string, text: string) {
  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
  await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }) }).catch(e => console.error('Telegram send error', e));
}
