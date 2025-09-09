// packages/shared/plan.ts

// ---------- Types ----------
export type PlanTier =
  | "free"
  | "lite"
  | "steady"
  | "serious"
  | "limited"
  | "elite";

export interface PlanDetails {
  code: PlanTier;
  label: string;
  amount: number;      // KES
  days: number;        // default access window
  papersPerDay: number;
  hoursPerDay: number; // per-session cap (Elite uses 24)
  pdf: boolean;
  voice: boolean;
  drills: boolean;
}

export interface UserPlan {
  tier: PlanTier;
  /** null = lifetime (e.g. if you ever decide limited = lifetime) */
  expiresAt: Date | null;
}

// ---------- Canonical plans ----------
export const PLANS: Record<PlanTier, PlanDetails> = {
  lite: {
    code: "lite",
    label: "Lite Pass",
    amount: 69,
    days: 1,
    papersPerDay: 1,
    hoursPerDay: 3,
    pdf: false,
    voice: true,
    drills: false,
  },
  steady: {
    code: "steady",
    label: "Steady Pass",
    amount: 499,
    days: 7,
    papersPerDay: 1,
    hoursPerDay: 3,
    pdf: true,
    voice: true,
    drills: false,
  },
  serious: {
    code: "serious",
    label: "Serious Prep",
    amount: 2999,
    days: 30,
    papersPerDay: 2,
    hoursPerDay: 6,
    pdf: true,
    voice: true,
    drills: true,
  },
  limited: {
    code: "limited",
    label: "Limited-Edition Prep Pass",
    amount: 1499,
    days: 30,
    papersPerDay: 2,
    hoursPerDay: 6,
    pdf: true,
    voice: true,
    drills: true,
  },
  elite: {
    code: "elite",
    label: "Elite Prep",
    amount: 5999,
    days: 30,
    papersPerDay: 4,
    hoursPerDay: 24,
    pdf: true,
    voice: true,
    drills: true,
  },
  free: {
    code: "free",
    label: "Free 3-Hour Trial",
    amount: 0,
    days: 0,
    papersPerDay: 1,
    hoursPerDay: 3,
    pdf: false,
    voice: true,
    drills: false,
  },
};

// ---------- Convenience lookups ----------
export const PLAN_LABELS: Record<PlanTier, string> = Object.fromEntries(
  Object.values(PLANS).map((p) => [p.code, p.label])
) as Record<PlanTier, string>;

export const PLAN_PRICES_KES: Record<PlanTier, number> = Object.fromEntries(
  Object.values(PLANS).map((p) => [p.code, p.amount])
) as Record<PlanTier, number>;

export const PLAN_LIMITS = Object.fromEntries(
  Object.values(PLANS).map((p) => [
    p.code,
    { papersPerDay: p.papersPerDay, maxHoursPerSession: p.hoursPerDay },
  ])
) as Record<PlanTier, { papersPerDay: number; maxHoursPerSession: number }>;

// Helper: find plan by M-PESA amount
export function planFromAmount(amount: number): PlanDetails | null {
  const found = Object.values(PLANS).find((p) => p.amount === amount);
  return found || null;
}

// ---------- Minimal “DB” stubs (replace with Mongo) ----------
const _memoryPlans = new Map<string, UserPlan>();

export async function getUserPlan(userId: string): Promise<UserPlan> {
  return _memoryPlans.get(userId) ?? { tier: "free", expiresAt: null };
}

/**
 * Persist a user’s plan after payment.
 * @param opts.days override length (default from PLANS[tier].days)
 * @param opts.lifetime set true for never-expire (null expiresAt)
 * @param opts.receipt M-PESA receipt number (optional log)
 */
export async function upgradeUserPlan(
  userId: string,
  tier: Exclude<PlanTier, "free">,
  opts?: { days?: number; lifetime?: boolean; receipt?: string }
): Promise<UserPlan> {
  const base = PLANS[tier];
  const days = opts?.days ?? base.days;

  const expiresAt = opts?.lifetime
    ? null
    : new Date(Date.now() + days * 86_400_000);

  const next: UserPlan = { tier, expiresAt };
  _memoryPlans.set(userId, next);

  // Visible log while wiring Daraja/Mongo
  console.log("[upgradeUserPlan]", {
    userId,
    tier,
    label: PLAN_LABELS[tier],
    lifetime: opts?.lifetime ?? false,
    days,
    expiresAt,
    receipt: opts?.receipt,
  });

  return next;
}
