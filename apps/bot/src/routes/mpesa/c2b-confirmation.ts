// apps/bot/src/routes/mpesa/c2b-confirmation.ts
import express, { type Request, type Response, type NextFunction } from "express";
import mongoose from "mongoose";
import { planFromAmount, upgradeUserPlan } from "../../repo/planRepo.js";
// import { notifyAdmin } from "../../lib/notify.js"; // optional: use if you want alerts

export const router = express.Router();

/* ---------- guards ---------- */
const jsonOnly = (req: Request, res: Response, next: NextFunction) => {
  const ct = (req.headers["content-type"] || "").toString().toLowerCase();
  if (ct.includes("application/json")) return next();
  return res.status(415).json({ ok: false, error: "content-type must be application/json" });
};

// optional: shared secret header (recommended)
function requireCallbackSecret(req: Request, res: Response, next: NextFunction) {
  const expected = (process.env.MPESA_CALLBACK_SECRET || "").trim();
  if (!expected) return next(); // disabled
  const got = (req.get("x-callback-secret") || "").trim();
  if (!got || got !== expected) return res.status(401).json({ ok: false, error: "unauthorized" });
  next();
}

// optional: IP allowlist (comma-separated)
function allowlistIp(req: Request, res: Response, next: NextFunction) {
  const list = (process.env.CALLBACK_ALLOW_IPS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!list.length) return next();
  const ip =
    (req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
      req.ip ||
      req.socket.remoteAddress ||
      "unknown").toString();
  if (!list.includes(ip)) return res.status(403).json({ ok: false, error: "forbidden" });
  next();
}

/* ---------- types ---------- */
type ItemKV = { Name: string; Value: unknown };

type StkCallback = {
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResultCode?: number | string;
  ResultDesc?: string;
  CallbackMetadata?: { Item?: ItemKV[] };
};

type StkBody = { Body?: { stkCallback?: StkCallback } };

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

/* ---------- tiny helpers ---------- */
function getItem(items: ItemKV[] | undefined, name: string): unknown {
  return items?.find((it) => it?.Name === name)?.Value;
}

function parseMpesaTimestamp14(v: string | undefined | null): Date | null {
  const s = String(v ?? "");
  if (!/^\d{14}$/.test(s)) return null;
  const yyyy = Number(s.slice(0, 4));
  const mm = Number(s.slice(4, 6)) - 1;
  const dd = Number(s.slice(6, 8));
  const HH = Number(s.slice(8, 10));
  const MM = Number(s.slice(10, 12));
  const SS = Number(s.slice(12, 14));
  const d = new Date(Date.UTC(yyyy, mm, dd, HH, MM, SS));
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeTelegramId(s: string): string {
  // Allow numeric ID; if a username slipped in, just pass through.
  const t = s.trim();
  // If you want to *enforce* numeric-only IDs:
  // if (!/^\d+$/.test(t)) throw new Error("AccountReference must be a numeric Telegram ID");
  return t;
}

/* ---------- idempotent writer ---------- */
async function recordPaymentIfNew(p: PaymentDoc): Promise<{ created: boolean }> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Mongo not connected");

  const coll = db.collection<PaymentDoc>("payments");

  // ensure uniq indexes (no crash if already exist)
  await Promise.allSettled([
    coll.createIndex({ receipt: 1 }, { unique: true, sparse: true, name: "uniq_receipt" }),
    coll.createIndex({ checkoutId: 1 }, { unique: true, sparse: true, name: "uniq_checkout" }),
  ]);

  // Build an idempotency filter:
  // 1) Prefer strong keys (receipt or checkoutId); else 2) fallback to {tgId, amount, minute-bucketed txAt}
  const filter: any = {};
  if (p.receipt && p.checkoutId) filter.$or = [{ receipt: p.receipt }, { checkoutId: p.checkoutId }];
  else if (p.receipt) filter.receipt = p.receipt;
  else if (p.checkoutId) filter.checkoutId = p.checkoutId;
  else {
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

/* ---------- route ---------- */
router.post("/", jsonOnly, allowlistIp, requireCallbackSecret, async (req: Request, res: Response) => {
  // ACK immediately so Daraja doesn’t retry
  res.json({ ok: true });

  // process async (don’t block the ACK)
  (async () => {
    try {
      const body = (req.body ?? {}) as StkBody;
      const cb = body?.Body?.stkCallback;
      if (!cb) {
        console.warn("STK callback: missing Body.stkCallback");
        return;
      }

      const resultCode = Number(cb?.ResultCode ?? 1);
      const resultDesc = String(cb?.ResultDesc || "");
      const checkoutId = (cb?.CheckoutRequestID ? String(cb.CheckoutRequestID) : "") || null;
      const items = (cb?.CallbackMetadata?.Item ?? []) as ItemKV[];

      // Pull details out of metadata
      const amountRaw = getItem(items, "Amount");
      const acctRaw = getItem(items, "AccountReference");
      const receiptRaw = getItem(items, "MpesaReceiptNumber");
      const dateRaw = getItem(items, "TransactionDate");
      const phoneRaw = getItem(items, "PhoneNumber");

      const amount = amountRaw != null ? Number(amountRaw) : null;
      const accountRef = acctRaw != null ? normalizeTelegramId(String(acctRaw)) : null;
      const receipt = receiptRaw != null ? String(receiptRaw) : null;
      const txAt = parseMpesaTimestamp14(typeof dateRaw === "number" ? String(dateRaw) : (dateRaw as string | null));
      const phone = phoneRaw != null ? String(phoneRaw) : null;

      if (resultCode !== 0) {
        console.warn("STK declined:", { resultDesc, checkoutId, accountRef, amount });
        return;
      }
      if (amount == null || !Number.isFinite(amount)) {
        console.warn("STK callback missing/invalid Amount:", { amountRaw });
        return;
      }
      if (!accountRef) {
        console.warn("STK callback missing AccountReference (Telegram ID):", items);
        return;
      }

      const mapping = planFromAmount(amount);
      if (!mapping) {
        console.warn("Unknown payment amount:", { amount, checkoutId });
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
        checkoutId,
        txAt: txAt ?? new Date(),
        phone: phone || null,
        createdAt: new Date(),
        meta: { resultDesc, raw: body },
      });

      if (!created) {
        console.log(`↩️ Duplicate payment ignored (chk=${checkoutId ?? "-"} rec=${receipt ?? "-"}) for ${accountRef}`);
        return;
      }

      // Upgrade the plan
      try {
        await upgradeUserPlan(accountRef, tier, { days });
      } catch (e: any) {
        // If upgrading fails, we still keep the payment record; you can reconcile later.
        console.error("upgradeUserPlan failed:", e?.message || e);
        // await notifyAdmin?.(`⚠️ Plan upgrade failed\n<b>User:</b> ${accountRef}\n<b>Tier:</b> ${tier}\n<b>Days:</b> ${days}`);
        return;
      }

      console.log(
        `🎉 Upgraded ${accountRef} → ${tier} (${days} days) [KES ${amount}]` +
          (receipt ? ` • Receipt ${receipt}` : "") +
          (txAt ? ` • ${txAt.toISOString()}` : "")
      );
    } catch (err: any) {
      console.error("Callback handler error:", err?.message || err);
    }
  })();
});
