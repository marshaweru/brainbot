// apps/bot/src/repo/paymentsRepo.ts
// Minimal Mongo repo for M-PESA payments (idempotent inserts).

import { MongoClient, Db, Collection } from "mongodb";

const MONGO_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DB || "brainbot";
let _db: Db | null = null;

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

async function db(): Promise<Db> {
  if (_db) return _db;
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  _db = client.db(DB_NAME);
  await ensureIndexes(_db);
  return _db;
}

async function ensureIndexes(d: Db) {
  const col = d.collection<PaymentDoc>("payments");
  // Unique when present. Mongo treats `null` as a value, so use partialFilterExpression.
  await col.createIndex(
    { checkoutId: 1 },
    { unique: true, sparse: true, partialFilterExpression: { checkoutId: { $type: "string" } } }
  );
  await col.createIndex(
    { receipt: 1 },
    { unique: true, sparse: true, partialFilterExpression: { receipt: { $type: "string" } } }
  );
  await col.createIndex({ telegramId: 1, createdAt: -1 });
}

function parseTxnDateYYYYMMDDhhmmss(s?: string | number | null): Date | null {
  if (!s) return null;
  const str = String(s);
  // Expect 14 digits: YYYYMMDDhhmmss (Daraja style)
  if (!/^\d{14}$/.test(str)) return null;
  const y = Number(str.slice(0, 4));
  const m = Number(str.slice(4, 6)) - 1; // JS month 0-based
  const d = Number(str.slice(6, 8));
  const hh = Number(str.slice(8, 10));
  const mm = Number(str.slice(10, 12));
  const ss = Number(str.slice(12, 14));
  // Daraja timestamps are in Africa/Nairobi local time.
  // Store as UTC by constructing a Date from the local components:
  const dt = new Date(Date.UTC(y, m, d, hh, mm, ss));
  // If you prefer to keep local, you could just return new Date(y, m, d, hh, mm, ss)
  return dt;
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
  const d = await db();
  const col = d.collection<PaymentDoc>("payments");

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

  // Idempotency: try insert; if duplicate key on receipt or checkoutId → treat as already processed
  try {
    await col.insertOne(doc);
    return { created: true };
  } catch (e: any) {
    // 11000 = duplicate key
    if (e?.code === 11000) return { created: false };
    throw e;
  }
}
