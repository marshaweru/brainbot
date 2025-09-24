// apps/web/lib/telegram.ts
// Resolve logged-in user → telegramId used by the bot/payments.

import { db } from "./db.js";
import { ObjectId, Db } from "mongodb";

type UserDoc = {
  _id: ObjectId | string;
  telegramId?: string | number | null;
  wid?: string | null; // some schemas store null when unlinked
};

type UserLinkDoc = {
  wid: string;
  telegramId?: string | number | null;
  userId?: string | ObjectId;
};

function normalizeTid(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  // Telegram user IDs are numeric and usually >= 5 digits
  if (!/^\d{5,}$/.test(s)) return null;
  return s;
}

async function getUserById(database: Db, userId: string): Promise<UserDoc | null> {
  const users = database.collection<UserDoc>("users");

  // Try ObjectId, then literal string _id
  if (ObjectId.isValid(userId)) {
    const byObj = await users.findOne(
      { _id: new ObjectId(userId) },
      { projection: { telegramId: 1, wid: 1 } }
    );
    if (byObj) return byObj;
  }
  return users.findOne(
    { _id: userId as any },
    { projection: { telegramId: 1, wid: 1 } }
  );
}

async function getTidFromUserLinks(
  database: Db,
  widOrUserId: string | ObjectId | null | undefined
) {
  if (widOrUserId == null) return null; // handles null/undefined
  const links = database.collection<UserLinkDoc>("user_links");

  // 1) If this is clearly a WID (string), look it up directly.
  if (typeof widOrUserId === "string" && widOrUserId.trim()) {
    const link = await links.findOne(
      { wid: widOrUserId.trim() },
      { projection: { telegramId: 1 } }
    );
    return normalizeTid(link?.telegramId);
  }

  // 2) Otherwise try userId in the links collection (schemas vary).
  const byUserId = await links.findOne(
    { userId: widOrUserId as any },
    { projection: { telegramId: 1 } }
  );
  return normalizeTid(byUserId?.telegramId);
}

/**
 * Returns the user's Telegram ID (as a string) or null if unknown.
 * Lookup order:
 *   users.telegramId → user_links(wid) → user_links(userId)
 */
export async function getUserTelegramId(userId: string): Promise<string | null> {
  if (!userId) return null;

  const database = await db();
  const user = await getUserById(database, userId);
  if (!user) return null;

  // 1) Direct on the user doc
  const direct = normalizeTid(user.telegramId);
  if (direct) return direct;

  // 2) Via wid → user_links (allow null/undefined)
  const viaWid = await getTidFromUserLinks(database, user.wid ?? undefined);
  if (viaWid) return viaWid;

  // 3) Via userId → user_links (supports schemas that store userId there)
  const userIdKey = typeof user._id === "string" ? user._id : user._id.toString();
  const viaUserId = await getTidFromUserLinks(database, userIdKey);
  if (viaUserId) return viaUserId;

  return null;
}
