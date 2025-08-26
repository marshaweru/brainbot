// apps/bot/src/utils/daily.ts
import type { Collection } from "mongodb";

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
  subjectsDone: number;      // how many subjects completed today
};

export type UserDoc = {
  telegramId: string;
  daily?: UserDaily;
  updatedAt?: Date;
  // ... other user fields
  [k: string]: unknown;
};

/**
 * Reset the embedded user.daily counters if the stored date !== Nairobi today.
 * Returns true if a reset happened, false if already up-to-date.
 */
export async function ensureDailyReset(
  usersCol: Collection<UserDoc> | any,
  user: UserDoc
): Promise<boolean> {
  const today = nairobiDate();
  const current = user?.daily?.date;

  if (current === today) return false;

  await usersCol.updateOne(
    { telegramId: user.telegramId },
    {
      $set: {
        "daily.date": today,
        "daily.minutesUsed": 0,
        "daily.subjectsDone": 0,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        // If you ever call this for a not-yet-inserted user
        createdAt: new Date(),
      },
    },
    { upsert: false } // expect user to exist here; flip to true if desired
  );

  return true;
}
