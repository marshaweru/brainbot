// apps/bot/src/repo/planRepo.ts
import { connectMongo } from "../db/mongo.js";
import { UserPlanModel } from "../models/UserPlan.js";

/* ---------- Types ---------- */
export type PlanTier = "free" | "lite" | "steady" | "serious" | "elite" | "limited";
type PaidTier = Exclude<PlanTier, "free">;

export interface PlanMapping { tier: PaidTier; days: number; }

export interface UserPlan {
  telegramId: string;
  tier: PlanTier;
  expiresAt: Date | null;
  papersUsed: number;
  createdAt?: Date;
  updatedAt?: Date;
  lastSession?: Date;
  receipts?: unknown[];
}

/* ---------- Price map (single source of truth) ---------- */
// Use a union of numeric literals for the keys; assert inner tier literals with `as const`.
type PriceKey = 69 | 499 | 1499 | 2999 | 5999;

export const PLAN_PRICES: Record<PriceKey, PlanMapping> = {
  69:   { tier: "lite",    days: 1  },
  499:  { tier: "steady",  days: 7  },
  1499: { tier: "limited", days: 30 },
  2999: { tier: "serious", days: 30 },
  5999: { tier: "elite",   days: 30 },
} as const;

export const ALLOWED_AMOUNTS = new Set<number>([69, 499, 1499, 2999, 5999]);

export const DEFAULT_TIER_DAYS: Record<PaidTier, number> = {
  lite: 1,
  steady: 7,
  limited: 30,
  serious: 30,
  elite: 30,
} as const;

/* ---------- Trial window ---------- */
const FREE_TRIAL_HOURS = Math.min(24, Math.max(1, Number(process.env.FREE_TRIAL_HOURS ?? 3)));

/* ---------- Lookups ---------- */
export function planFromAmount(amount: number): PlanMapping | null {
  // Amount keys are numeric; TS narrows correctly via `as PriceKey` check.
  return (PLAN_PRICES as Record<number, PlanMapping>)[amount] ?? null;
}

export function planForTier(tier: PaidTier): PlanMapping {
  return { tier, days: DEFAULT_TIER_DAYS[tier] };
}

/* ---------- Queries ---------- */
export async function getUserPlan(telegramId: string) {
  await connectMongo();
  const now = new Date();
  const trialExpiry = new Date(now.getTime() + FREE_TRIAL_HOURS * 3600 * 1000);

  const doc = await UserPlanModel.findOneAndUpdate(
    { telegramId },
    {
      $setOnInsert: {
        telegramId,
        tier: "free" as PlanTier,
        expiresAt: trialExpiry,
        papersUsed: 0,
        createdAt: now,
      },
      $set: { updatedAt: now },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean<UserPlan>(); // 👈 lean() gets a proper shape

  return doc!;
}

/* Upgrade semantics:
 * - lifetime: tier set, expiresAt = null
 * - same tier: extend from current expiry if in future, else from now
 * - higher/different tier: switch tier and set fresh expiry from now
 * Returns updated plan.
 */
export async function upgradeUserPlan(
  telegramId: string,
  newTier: PaidTier,
  opts: { days?: number; lifetime?: boolean; receipt?: unknown } = {}
) {
  await connectMongo();
  const now = new Date();

  const addDays = opts.days ?? DEFAULT_TIER_DAYS[newTier];
  const addMs = addDays * 24 * 3600 * 1000;

  const current = await UserPlanModel.findOne({ telegramId }).lean<UserPlan>(); // 👈 typed

  let nextExpiry: Date | null;
  if (opts.lifetime) {
    nextExpiry = null;
  } else {
    const base =
      current?.tier === newTier &&
      current?.expiresAt &&
      current.expiresAt.getTime() > now.getTime()
        ? current.expiresAt
        : now;
    nextExpiry = new Date(base.getTime() + addMs);
  }

  const updated = await UserPlanModel.findOneAndUpdate(
    { telegramId },
    {
      $setOnInsert: { telegramId, createdAt: now },
      $set: {
        tier: newTier as PlanTier,
        expiresAt: nextExpiry, // null => lifetime
        papersUsed: 0,
        updatedAt: now,
      },
      ...(opts.receipt ? ({ $addToSet: { receipts: opts.receipt } } as any) : {}),
    },
    { upsert: true, new: true }
  ).lean<UserPlan>();

  return updated!;
}

export async function usePaper(telegramId: string) {
  await connectMongo();
  await UserPlanModel.updateOne(
    { telegramId },
    { $inc: { papersUsed: 1 }, $set: { lastSession: new Date(), updatedAt: new Date() } }
  );
}

/* ---------- Helpers ---------- */
export function isPaidTier(tier: PlanTier): tier is PaidTier {
  return tier !== "free";
}
