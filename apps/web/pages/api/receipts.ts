// apps/web/pages/api/receipts.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getUserTelegramId } from "@/lib/telegram";

type Receipt = {
  amount: number;
  tier: string;
  days: number;
  receipt?: string | null;
  checkoutId?: string | null;
  txAt?: string | null;   // ISO
  createdAt: string;      // ISO
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  // never cache receipts
  res.setHeader("Cache-Control", "no-store");

  try {
    const user = await getSessionUser(req, res);
    if (!user) return res.status(401).json({ ok: false, error: "auth required" });

    const telegramId = await getUserTelegramId(user.id);
    if (!telegramId) return res.status(400).json({ ok: false, error: "link Telegram first" });

    // optional pagination
    const limit = Math.max(1, Math.min(100, Number(req.query.limit ?? 50)));
    const cursorISO = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const cursor = cursorISO ? new Date(cursorISO) : undefined;

    const conn = await db();
    const payments = conn.collection("payments");

    const query: any = { telegramId };
    if (cursor && !isNaN(cursor.getTime())) {
      // fetch items strictly older than cursor.createdAt
      query.createdAt = { $lt: cursor };
    }

    const rows = await payments
      .find(query, {
        projection: {
          _id: 0,
          amount: 1,
          tier: 1,
          days: 1,
          receipt: 1,
          checkoutId: 1,
          txAt: 1,
          createdAt: 1,
        },
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const data: Receipt[] = rows.map((r) => ({
      amount: r.amount,
      tier: r.tier,
      days: r.days,
      receipt: r.receipt ?? null,
      checkoutId: r.checkoutId ?? null,
      txAt: r.txAt ? new Date(r.txAt).toISOString() : null,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    }));

    // next cursor for “Load more”
    const nextCursor = rows.length === limit ? data[data.length - 1]?.createdAt : null;

    return res.json({ ok: true, receipts: data, nextCursor });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
}
