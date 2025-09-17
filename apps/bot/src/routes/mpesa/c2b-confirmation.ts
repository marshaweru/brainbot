// apps/bot/src/routes/mpesa/c2b-confirmation.ts
import express, { type Request, type Response } from "express";
import mongoose from "mongoose";
import { planFromAmount, upgradeUserPlan } from "../../repo/planRepo.js";

export const router = express.Router();

/** Minimal payment doc type for this route */
type PaymentDoc = {
  telegramId: string;
  amount: number;
  tier: string;
  days: number;
  receipt?: string | null;      // MpesaReceiptNumber
  checkoutId?: string | null;   // CheckoutRequestID
  txAt?: Date | null;           // ISO-able date
  phone?: string | null;
  createdAt: Date;
  meta?: any;
};

/**
 * Idempotent writer: dedupe by receipt OR checkoutId.
 * Returns { created: true } if inserted; false if already existed.
 */
async function recordPaymentIfNew(p: PaymentDoc): Promise<{ created: boolean }> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Mongo not connected yet (mongoose.connection.db is undefined)");
  }

  const coll = db.collection<PaymentDoc>("payments");

  // Ensure unique indexes (safe if they already exist)
  try {
    await Promise.allSettled([
      coll.createIndex({ receipt: 1 }, { unique: true, sparse: true, name: "uniq_receipt" }),
      coll.createIndex({ checkoutId: 1 }, { unique: true, sparse: true, name: "uniq_checkout" }),
    ]);
  } catch {
    // ignore
  }

  const filter: any = {};
  if (p.receipt && p.checkoutId) filter.$or = [{ receipt: p.receipt }, { checkoutId: p.checkoutId }];
  else if (p.receipt) filter.receipt = p.receipt;
  else if (p.checkoutId) filter.checkoutId = p.checkoutId;
  else {
    // last-resort dedupe by (telegramId, amount, txAt minute)
    const keyTime = p.txAt ? new Date(Math.floor(p.txAt.getTime() / 60000) * 60000) : new Date();
    filter.telegramId = p.telegramId;
    filter.amount = p.amount;
    filter.txAt = keyTime;
  }

  const update = {
    $setOnInsert: {
      telegramId: p.telegramId,
      amount: p.amount,
      tier: p.tier,
      days: p.days,
      receipt: p.receipt ?? null,
      checkoutId: p.checkoutId ?? null,
      txAt: p.txAt ?? new Date(),
      phone: p.phone ?? null,
      createdAt: new Date(),
      meta: p.meta ?? null,
    } as PaymentDoc,
  };

  const res = await coll.updateOne(filter, update, { upsert: true });
  const created = !!res.upsertedId || res.matchedCount === 0;
  return { created };
}

router.post("/", async (req: Request, res: Response) => {
  // ACK immediately so Daraja won't retry
  res.json({ ok: true });

  (async () => {
    try {
      const body = req.body;
      const cb = body?.Body?.stkCallback;
      if (!cb) return;

      const resultCode = Number(cb?.ResultCode ?? 1);
      const resultDesc = String(cb?.ResultDesc || "");
      const checkoutId = String(cb?.CheckoutRequestID || "");

      const items = (cb?.CallbackMetadata?.Item ?? []) as Array<{ Name: string; Value: any }>;

      let amount: number | null = null;
      let accountRef: string | null = null; // Telegram ID
      let receipt: string | null = null;    // MpesaReceiptNumber
      let txAt: Date | null = null;
      let phone: string | null = null;

      for (const it of items) {
        switch (it.Name) {
          case "Amount":
            amount = Number(it.Value);
            break;
          case "AccountReference":
            accountRef = it.Value != null ? String(it.Value) : null;
            break;
          case "MpesaReceiptNumber":
            receipt = it.Value != null ? String(it.Value) : null;
            break;
          case "TransactionDate": {
            const v = String(it.Value || "");
            if (/^\d{14}$/.test(v)) {
              const yyyy = Number(v.slice(0, 4));
              const mm = Number(v.slice(4, 6)) - 1;
              const dd = Number(v.slice(6, 8));
              const HH = Number(v.slice(8, 10));
              const MM = Number(v.slice(10, 12));
              const SS = Number(v.slice(12, 14));
              txAt = new Date(Date.UTC(yyyy, mm, dd, HH, MM, SS));
            }
            break;
          }
          case "PhoneNumber":
            phone = it.Value != null ? String(it.Value) : null;
            break;
          default:
            // ignore others
            break;
        }
      }

      if (resultCode !== 0) {
        console.error("❌ STK failed:", resultDesc, { checkoutId, accountRef, amount });
        return;
      }
      if (amount == null) {
        console.error("❌ STK callback missing Amount:", items);
        return;
      }
      if (!accountRef) {
        console.error("❌ STK callback missing AccountReference (Telegram ID):", items);
        return;
      }

      const mapping = planFromAmount(amount);
      if (!mapping) {
        console.error("❌ Unknown payment amount:", amount, "checkout:", checkoutId);
        return;
      }
      const { tier, days } = mapping;

      // Idempotent write
      const { created } = await recordPaymentIfNew({
        telegramId: accountRef,
        amount,
        tier,
        days,
        receipt: receipt || null,
        checkoutId: checkoutId || null,
        txAt: txAt ?? new Date(),
        phone: phone || null,
        createdAt: new Date(),
        meta: { resultDesc, raw: body },
      });

      if (!created) {
        console.log(`↩️ Duplicate payment ignored (chk=${checkoutId} rec=${receipt}) for ${accountRef}`);
        return;
      }

      await upgradeUserPlan(accountRef, tier, { days });

      console.log(
        `🎉 Upgraded ${accountRef} → ${tier} (${days} days) [KES ${amount}]` +
          (receipt ? ` • Receipt ${receipt}` : "") +
          (txAt ? ` • ${txAt.toISOString()}` : "")
      );
    } catch (err) {
      console.error("💥 STK callback handler error:", err);
    }
  })();
});
