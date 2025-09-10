import { connectMongo } from "../db/mongo";
import { UserPlanModel } from "../models/UserPlan";

export type PlanTier = "free" | "lite" | "steady" | "serious" | "elite" | "limited";

const PRICES: Record<number, { tier: Exclude<PlanTier, "free">; days: number }> = {
  69:   { tier: "lite",    days: 1  },
  499:  { tier: "steady",  days: 7  },
  1499: { tier: "limited", days: 30 },
  2999: { tier: "serious", days: 30 },
  5999: { tier: "elite",   days: 30 },
};

const FREE_TRIAL_HOURS = Math.max(1, Number(process.env.FREE_TRIAL_HOURS ?? 3));

export function planFromAmount(
  amount: number
): { tier: Exclude<PlanTier, "free">; days: number } | null {
  return PRICES[amount] ?? null;
}

/** Ensure a plan doc exists; return the persisted doc. */
export async function getUserPlan(telegramId: string) {
  await connectMongo();
  const doc = await UserPlanModel.findOneAndUpdate(
    { telegramId },
    {
      $setOnInsert: {
        telegramId,
        tier: "free",
        expiresAt: new Date(Date.now() + FREE_TRIAL_HOURS * 3600 * 1000),
        papersUsed: 0,
        // lastSession intentionally omitted (avoids null-type mismatch)
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return doc!;
}

export async function upgradeUserPlan(
  telegramId: string,
  newTier: Exclude<PlanTier, "free">,
  opts: { days?: number; lifetime?: boolean; receipt?: unknown } = {}
) {
  await connectMongo();
  const days = opts.days ?? 30;
  const expiresAt = opts.lifetime ? undefined : new Date(Date.now() + days * 24 * 3600 * 1000);

  await UserPlanModel.findOneAndUpdate(
    { telegramId },
    {
      $setOnInsert: { telegramId },
      $set: {
        tier: newTier,
        ...(expiresAt ? { expiresAt } : {}),
        papersUsed: 0,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );
}

export async function usePaper(telegramId: string) {
  await connectMongo();
  await UserPlanModel.updateOne(
    { telegramId },
    { $inc: { papersUsed: 1 }, $set: { lastSession: new Date() } }
  );
}
