// apps/web/lib/telegram.ts
// Resolve logged-in user → telegramId used by the bot/payments.
import { db } from "./db";   // 🔥 removed `.js`
import { ObjectId } from "mongodb";

export async function getUserTelegramId(userId: string): Promise<string | null> {
  if (!userId) return null;

  const conn = await db();
  const users = conn.collection("users");

  // Try by ObjectId, then by string id
  let doc = null;
  if (ObjectId.isValid(userId)) {
    doc = await users.findOne(
      { _id: new ObjectId(userId) },
      { projection: { telegramId: 1, wid: 1 } }
    );
  }
  if (!doc) {
    doc = await users.findOne(
      { _id: userId } as any,
      { projection: { telegramId: 1, wid: 1 } }
    );
  }

  // Common fields we’ve used: telegramId or wid
  const tid = doc?.telegramId ?? doc?.wid ?? null;

  // Dev fallback: allow proxy via header for testing
  // (e.g., fetch(..., { headers: { 'x-telegram-id': '123456789' } }))
  // @ts-ignore
  if (!tid && typeof globalThis !== "undefined") {
    // no-op: API routes can't access request here; kept for parity
  }

  return tid ? String(tid) : null;
}
