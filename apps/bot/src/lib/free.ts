// apps/bot/src/lib/free.ts
import { connectDB } from "./db.js";

export const FREE_SUBJECT_LIMIT = 2;

/**
 * Record that a free user has successfully completed a subject session.
 * - Adds the subject to a unique set (max 2)
 * - Never throws on duplicate-user races (E11000 swallowed)
 * - Always returns { atLimit, subjects, remaining }
 */
export async function claimFreeSubject(telegramId: string, subjectSlug: string) {
  const db = await connectDB();
  const users = db.collection("users");

  // Read current snapshot (older Mongo drivers prefer explicit read first)
  const doc: any = await users.findOne(
    { telegramId },
    { projection: { "free.subjects": 1 } }
  );
  const current: string[] = Array.isArray(doc?.free?.subjects)
    ? doc.free.subjects
    : [];

  // Only attempt to add if under cap AND not already present
  if (!current.includes(subjectSlug) && current.length < FREE_SUBJECT_LIMIT) {
    try {
      await users.updateOne(
        { telegramId },
        {
          $setOnInsert: { telegramId, createdAt: new Date() },
          $addToSet: { "free.subjects": subjectSlug },
          $set: { updatedAt: new Date() },
        },
        { upsert: true }
      );
    } catch (e: any) {
      // Ignore rare duplicate key races on uniq telegramId
      if (e?.code !== 11000) throw e;
    }
  } else {
    // Ensure base doc exists & touch updatedAt
    try {
      await users.updateOne(
        { telegramId },
        {
          $setOnInsert: { telegramId, createdAt: new Date() },
          $set: { updatedAt: new Date() },
        },
        { upsert: true }
      );
    } catch (e: any) {
      if (e?.code !== 11000) throw e;
    }
  }

  // Re-read to compute remaining
  const after: any = await users.findOne(
    { telegramId },
    { projection: { "free.subjects": 1 } }
  );
  const subjects: string[] = Array.isArray(after?.free?.subjects)
    ? after.free.subjects
    : [];
  const remaining = Math.max(0, FREE_SUBJECT_LIMIT - subjects.length);
  const atLimit = subjects.length >= FREE_SUBJECT_LIMIT;

  return { atLimit, subjects, remaining };
}

/** Lightweight read helper for UI copy */
export async function getFreeState(telegramId: string) {
  const db = await connectDB();
  const users = db.collection("users");
  const doc: any = await users.findOne(
    { telegramId },
    { projection: { "free.subjects": 1 } }
  );
  const subjects: string[] = Array.isArray(doc?.free?.subjects)
    ? doc.free.subjects
    : [];
  return {
    subjects,
    remaining: Math.max(0, FREE_SUBJECT_LIMIT - subjects.length),
  };
}
