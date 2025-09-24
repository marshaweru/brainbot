// packages/shared/plan.ts

// ---------- Types ----------
export type PlanTier = "free" | "lite" | "steady" | "serious" | "limited" | "elite";

export interface PlanDetails {
  code: PlanTier;
  label: string;
  amount: number;      // KES (whole shillings)
  days: number;        // default access window
  papersPerDay: number;
  hoursPerDay: number; // hard cap per session
  pdf: boolean;
  voice: boolean;
  drills: boolean;
}

export interface UserPlan {
  tier: PlanTier;
  /** null = lifetime (never expires) */
  expiresAt: Date | null;
}

// ---------- Canonical plans ----------
export const PLANS: Record<PlanTier, PlanDetails> = {
  lite:    { code: "lite",    label: "Lite Pass",                 amount: 69,   days: 1,  papersPerDay: 1, hoursPerDay: 3,  pdf: false, voice: true,  drills: false },
  steady:  { code: "steady",  label: "Steady Pass",               amount: 499,  days: 7,  papersPerDay: 1, hoursPerDay: 3,  pdf: true,  voice: true,  drills: false },
  serious: { code: "serious", label: "Serious Prep",              amount: 2999, days: 30, papersPerDay: 2, hoursPerDay: 6,  pdf: true,  voice: true,  drills: true  },
  limited: { code: "limited", label: "Limited-Edition Prep Pass", amount: 1499, days: 30, papersPerDay: 2, hoursPerDay: 6,  pdf: true,  voice: true,  drills: true  },
  elite:   { code: "elite",   label: "Elite Prep",                amount: 5999, days: 30, papersPerDay: 4, hoursPerDay: 24, pdf: true,  voice: true,  drills: true  },
  free:    { code: "free",    label: "Free 3 Hour 30 Min Trial",         amount: 0,    days: 0,  papersPerDay: 1, hoursPerDay: 3,  pdf: false, voice: true,  drills: false },
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

// ---------- Plan gating helpers ----------
/** True if plan is currently usable (free always counts as active). */
export function isPlanActive(plan: UserPlan | null | undefined, now = Date.now()): boolean {
  if (!plan) return false;
  if (plan.tier === "free") return true;
  if (plan.expiresAt === null) return true; // lifetime
  return plan.expiresAt.getTime() >= now;
}

/** Days remaining (ceil), or Infinity for lifetime, or 0 if expired/not set. */
export function daysRemaining(plan: UserPlan | null | undefined, now = Date.now()): number {
  if (!plan) return 0;
  if (plan.expiresAt === null && plan.tier !== "free") return Number.POSITIVE_INFINITY;
  if (!plan.expiresAt) return 0;
  const ms = plan.expiresAt.getTime() - now;
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

/** Limits + feature flags for a given tier. */
export function featuresForTier(tier: PlanTier) {
  const p = PLANS[tier];
  return {
    pdf: p.pdf,
    voice: p.voice,
    drills: p.drills,
    papersPerDay: p.papersPerDay,
    maxHoursPerSession: p.hoursPerDay,
  };
}

/** Compute the absolute session deadline (end time) from a start timestamp and plan tier. */
export function computeSessionDeadline(startAt: Date | number, tier: PlanTier): Date {
  const startMs = (startAt instanceof Date ? startAt.getTime() : startAt) || Date.now();
  const hours = Math.max(0, PLANS[tier].hoursPerDay);
  const endMs = startMs + hours * 3_600_000;
  return new Date(endMs);
}

/** Milliseconds remaining in the current session window (never negative). */
export function sessionRemainingMs(startAt: Date | number, tier: PlanTier, now = Date.now()): number {
  const end = computeSessionDeadline(startAt, tier).getTime();
  return Math.max(0, end - now);
}

/** Given an M-PESA amount, return the matching plan (tolerates tiny deltas if provided). */
export function planFromAmount(amount: number, toleranceKES = 0): PlanDetails | null {
  const amt = Math.round(amount);
  let best: PlanDetails | null = null;
  let bestDelta = Infinity;
  for (const p of Object.values(PLANS)) {
    const delta = Math.abs(p.amount - amt);
    if (delta < bestDelta) {
      best = p;
      bestDelta = delta;
    }
  }
  return best && bestDelta <= Math.max(0, toleranceKES) ? best : null;
}

// ---------- Minimal “DB” stubs (swap with Mongo later) ----------
const _memoryPlans = new Map<string, UserPlan>();

export async function getUserPlan(userId: string): Promise<UserPlan> {
  const got = _memoryPlans.get(userId);
  return got ?? { tier: "free", expiresAt: null };
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
  const days = Math.max(0, opts?.days ?? base.days);

  const expiresAt =
    opts?.lifetime ? null : new Date(Date.now() + days * 86_400_000);

  const next: UserPlan = { tier, expiresAt };
  _memoryPlans.set(userId, next);

  // Visible log while wiring Daraja/Mongo
  // eslint-disable-next-line no-console
  console.log("[upgradeUserPlan]", {
    userId,
    tier,
    label: base.label,
    lifetime: !!opts?.lifetime,
    days,
    expiresAt,
    receipt: opts?.receipt,
  });

  return next;
}
