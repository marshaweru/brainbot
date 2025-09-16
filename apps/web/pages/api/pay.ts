import type { NextApiRequest, NextApiResponse } from "next";

// You likely already have helpers:
import { getSessionUser } from "@/lib/auth"; // your auth
import { getUserTelegramId } from "@/lib/telegram"; // resolve wid->telegramId or from DB

const BOT_PAY_ENDPOINT = process.env.BOT_PAY_ENDPOINT!; // e.g. https://bot.yourdomain.com/mpesa/stk-initiate
const SERVICE_TOKEN = process.env.SERVICE_TOKEN!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const user = await getSessionUser(req, res); // must throw/return null if not logged
    if (!user) return res.status(401).json({ ok: false, error: "auth required" });

    // resolve accountRef (telegram id). Your code might already persist it server-side.
    const telegramId = await getUserTelegramId(user.id);
    if (!telegramId) return res.status(400).json({ ok: false, error: "link Telegram first" });

    const { phone, amount, description } = req.body || {};
    if (!phone || !amount) return res.status(400).json({ ok: false, error: "phone & amount required" });

    const r = await fetch(BOT_PAY_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${SERVICE_TOKEN}`,
      },
      body: JSON.stringify({
        phone,
        amount,
        accountRef: telegramId,
        description: description ?? "BrainBot Plan",
      }),
    });

    const json = await r.json();
    if (!r.ok) return res.status(r.status).json(json);
    return res.json(json);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
}
