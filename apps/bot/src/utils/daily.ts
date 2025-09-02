// apps/bot/src/utils/daily.ts
import type { Collection, WithId } from "mongodb";

export const TZ = "Africa/Nairobi" as const;

/** YYYY-MM-DD in Nairobi timezone (en-CA gives ISO-like date) */
export function nairobiDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

/** e.g., "21 Aug 2025" in Nairobi timezone (used for user-facing text) */
export function fmtDate(d: Date) {
  return d.toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: TZ,
  });
}

/** Shapes for the embedded daily counters on the user doc */
export type UserDaily = {
  date: string | null;       // YYYY-MM-DD (Africa/Nairobi) or null if unset
  minutesUsed: number;       // legacy counter (kept for compatibility)
  subjectsDone: number;      // how many sessions completed today (UI)
};

export type UserDoc = {
  telegramId: string;
  daily?: UserDaily;
  updatedAt?: Date;
  [k: string]: unknown;
};

/**
 * Atomically reset the embedded user.daily counters if the stored date !== Nairobi today.
 * - One round-trip using a $ne / $exists filter
 * - Upserts the user doc if it somehow doesn’t exist yet
 * Returns true if a reset (or upsert) happened, false if already up-to-date.
 */
export async function ensureDailyReset(
  usersCol: Collection<UserDoc> | any,
  user: Pick<UserDoc, "telegramId"> & Partial<UserDoc>
): Promise<boolean> {
  const today = nairobiDate();

  const res = await usersCol.updateOne(
    {
      telegramId: user.telegramId,
      $or: [{ "daily.date": { $ne: today } }, { "daily.date": { $exists: false } }],
    },
    {
      $set: {
        "daily.date": today,
        "daily.minutesUsed": 0,
        "daily.subjectsDone": 0,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  return Boolean(res.modifiedCount || res.upsertedCount);
}

/**
 * Increment today's embedded counters safely.
 * - Ensures the daily block is on "today" (resets if needed)
 * - Increments `subjectsDone` and/or `minutesUsed`
 */
export async function bumpDailyCounters(
  usersCol: Collection<UserDoc> | any,
  telegramId: string,
  deltas: { subjects?: number; minutes?: number } = {}
): Promise<void> {
  // Make sure the document is already on today
  await ensureDailyReset(usersCol, { telegramId });

  const inc: Record<string, number> = {};
  if (deltas.subjects) inc["daily.subjectsDone"] = deltas.subjects;
  if (deltas.minutes) inc["daily.minutesUsed"] = deltas.minutes;

  if (Object.keys(inc).length === 0) return;

  await usersCol.updateOne(
    { telegramId },
    { $inc: inc, $set: { updatedAt: new Date(), "daily.date": nairobiDate() } }
  );
}
