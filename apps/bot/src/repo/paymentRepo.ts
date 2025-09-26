// apps/bot/src/repo/paymentsRepo.ts
// Minimal payments repo (idempotent inserts) using the existing Mongoose connection.

import mongoose from "mongoose";
import { connectMongo } from "../db/mongo.js";

type PaymentDoc = {
  _id?: string;
  telegramId: string;         // accountRef
  amount: number;             // KES
  tier: string;               // mapped tier
  days: number;               // subscription duration
  checkoutId?: string | null; // STK CheckoutRequestID (top-level cb)
  receipt?: string | null;    // MpesaReceiptNumber
  txAt?: Date | null;         // parsed TransactionDate
  raw: any;                   // full raw callback for audit
  createdAt: Date;
};

async function getColl() {
  await connectMongo();
  const db = mongoose.connection.db;
  if (!db) throw new Error("Mongo not connected yet (mongoose.connection.db is undefined)");
  const col = db.collection<PaymentDoc>("payments");

  // Ensure indexes once (safe if they already exist)
  await Promise.allSettled([
    col.createIndex(
      { checkoutId: 1 },
      { unique: true, sparse: true, partialFilterExpression: { checkoutId: { $type: "string" } }, name: "uniq_checkoutId" }
    ),
    col.createIndex(
      { receipt: 1 },
      { unique: true, sparse: true, partialFilterExpression: { receipt: { $type: "string" } }, name: "uniq_receipt" }
    ),
    col.createIndex({ telegramId: 1, createdAt: -1 }, { name: "by_user_createdAt" }),
  ]);

  return col;
}

function parseTxnDateYYYYMMDDhhmmss(s?: string | number | null): Date | null {
  if (!s) return null;
  const str = String(s);
  if (!/^\d{14}$/.test(str)) return null; // YYYYMMDDhhmmss
  const y = Number(str.slice(0, 4));
  const m = Number(str.slice(4, 6)) - 1;
  const d = Number(str.slice(6, 8));
  const hh = Number(str.slice(8, 10));
  const mm = Number(str.slice(10, 12));
  const ss = Number(str.slice(12, 14));
  // Treat as local Africa/Nairobi time but store UTC
  return new Date(Date.UTC(y, m, d, hh, mm, ss));
}

export async function recordPaymentIfNew(p: {
  telegramId: string;
  amount: number;
  tier: string;
  days: number;
  checkoutId?: string | null;
  receipt?: string | null;
  txDateRaw?: string | number | null;
  raw: any;
}): Promise<{ created: boolean }> {
  const col = await getColl();

  const txAt = parseTxnDateYYYYMMDDhhmmss(p.txDateRaw);

  const doc: PaymentDoc = {
    telegramId: p.telegramId,
    amount: p.amount,
    tier: p.tier,
    days: p.days,
    checkoutId: p.checkoutId ?? null,
    receipt: p.receipt ?? null,
    txAt,
    raw: p.raw,
    createdAt: new Date(),
  };

  try {
    await col.insertOne(doc);
    return { created: true };
  } catch (e: any) {
    // 11000 = duplicate key (checkoutId or receipt)
    if (e?.code === 11000) return { created: false };
    throw e;
  }
}
