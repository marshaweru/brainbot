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
    /** null = lifetime */
    expiresAt: Date | null;
}
export declare const PLANS: Record<PlanTier, PlanDetails>;
//# sourceMappingURL=plan.d.ts.map