export type PlanTier = "free" | "lite" | "steady" | "serious" | "limited" | "elite";
export interface PlanDetails {
    code: PlanTier;
    label: string;
    amount: number;
    days: number;
    papersPerDay: number;
    hoursPerDay: number;
    pdf: boolean;
    voice: boolean;
    drills: boolean;
}
export interface UserPlan {
    tier: PlanTier;
    /** null = lifetime (e.g. if you ever decide limited = lifetime) */
    expiresAt: Date | null;
}
export declare const PLANS: Record<PlanTier, PlanDetails>;
export declare const PLAN_LABELS: Record<PlanTier, string>;
export declare const PLAN_PRICES_KES: Record<PlanTier, number>;
export declare const PLAN_LIMITS: Record<PlanTier, {
    papersPerDay: number;
    maxHoursPerSession: number;
}>;
export declare function planFromAmount(amount: number): PlanDetails | null;
export declare function getUserPlan(userId: string): Promise<UserPlan>;
/**
 * Persist a user’s plan after payment.
 * @param opts.days override length (default from PLANS[tier].days)
 * @param opts.lifetime set true for never-expire (null expiresAt)
 * @param opts.receipt M-PESA receipt number (optional log)
 */
export declare function upgradeUserPlan(userId: string, tier: Exclude<PlanTier, "free">, opts?: {
    days?: number;
    lifetime?: boolean;
    receipt?: string;
}): Promise<UserPlan>;
