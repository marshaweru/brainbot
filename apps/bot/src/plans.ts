// apps/bot/src/plans.ts

export type PlanTier =
  | "free"
  | "lite"
  | "steady"
  | "serious"
  | "elite"
  | "limited";

type UserPlan = {
  telegramId: string;
  tier: PlanTier;
  expiresAt: Date | null;
  papersUsed: number;
  lastSession: Date | null;
};

const userPlans: Record<string, UserPlan> = {};

/** Map M-PESA amount → plan tier + days */
export function planFromAmount(
  amount: number
): { tier: PlanTier; days: number } | null {
  // Match your real pricing tiers
  const table: Record<number, { tier: PlanTier; days: number }> = {
    69: { tier: "lite", days: 1 }, // Lite Pass – 1 day
    499: { tier: "steady", days: 7 }, // Steady Pass – 7 days
    2999: { tier: "serious", days: 30 }, // Serious Prep – 30 days
    5999: { tier: "elite", days: 30 }, // Elite Prep – 30 days
    1499: { tier: "limited", days: 30 }, // Limited Edition Prep – 30 days
  };

  return table[amount] ?? null;
}

export function getUserPlan(telegramId: string): UserPlan {
  return (
    userPlans[telegramId] ?? {
      telegramId,
      tier: "free",
      // Free trial: 3 hours expiry
      expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
      papersUsed: 0,
      lastSession: null,
    }
  );
}

export function upgradeUserPlan(
  telegramId: string,
  newTier: PlanTier,
  opts: { days?: number; lifetime?: boolean; receipt?: unknown } = {}
): void {
  const days = opts.days ?? 30;
  const expiresAt = opts.lifetime
    ? null
    : new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  userPlans[telegramId] = {
    telegramId,
    tier: newTier,
    expiresAt,
    papersUsed: 0,
    lastSession: null,
  };
}

export function usePaper(telegramId: string) {
  const cur = getUserPlan(telegramId);
  cur.papersUsed += 1;
  cur.lastSession = new Date();
  userPlans[telegramId] = cur;
}
