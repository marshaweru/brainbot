// apps/bot/src/utils/tokenBudget.ts

// Single source of truth for session/marking budgets lives in prompts/system.ts.
// We import from there and re-export a compatible shape for legacy callers.
import { SESSION_BUDGET as SYS_SESSION_BUDGET } from "../prompts/system.js";

/* ───────────────── Legacy commercial plan codes ───────────────── */
export type PlanCode =
  | "LITE_DAY"
  | "PRO_WEEK"
  | "PLUS_MONTH"
  | "ULTRA_MONTH"
  | "FIRST100";

/** Daily token ceilings per legacy commercial plan (kept for back-compat). */
export const DAILY_TOKEN_CAP: Record<PlanCode, number> = {
  LITE_DAY: 10_000,
  PRO_WEEK: 10_000,
  PLUS_MONTH: 20_000,
  ULTRA_MONTH: 30_000,
  FIRST100: 15_000,
};

/* ─────────────── Modern plan/tier compatibility helpers ───────────────
   Elsewhere in the app we use plan codes like: lite, steady, serious, club84, founder
   and tiers like: free, lite, pro, plus, ultra.
   The helpers below map those to sensible token caps without changing legacy exports.
*/

/** Map modern plan codes (lite/steady/serious/club84/founder) to a daily cap. */
export function dailyTokenCapForPlanCode(planCode?: string): number {
  const s = String(planCode || "").toLowerCase();

  if (s === "lite") return 10_000;
  if (s === "steady" || s === "pro") return 10_000;
  if (s === "serious" || s === "plus" || s === "founder") return 20_000;
  if (s === "club84" || s === "ultra") return 30_000;

  // Legacy aliases if someone passes the old names into this helper
  if (s === "lite_day") return DAILY_TOKEN_CAP.LITE_DAY;
  if (s === "pro_week") return DAILY_TOKEN_CAP.PRO_WEEK;
  if (s === "plus_month") return DAILY_TOKEN_CAP.PLUS_MONTH;
  if (s === "ultra_month") return DAILY_TOKEN_CAP.ULTRA_MONTH;
  if (s === "first100") return DAILY_TOKEN_CAP.FIRST100;

  // Default: be conservative
  return 10_000;
}

/** Map runtime tiers to a daily cap (handy for metering by tier). */
export function dailyTokenCapForTier(tier?: string): number {
  const t = String(tier || "").toLowerCase();
  if (t === "lite") return 10_000;
  if (t === "pro") return 10_000;
  if (t === "plus") return 20_000;
  if (t === "ultra") return 30_000;
  // free: keep small but non-zero; or 0 if you truly want to meter it
  if (t === "free") return 5_000;
  return 10_000;
}

/* ───────────── Session budgets (mirrors prompts/system.ts) ───────────── */

export const SESSION_BUDGET = {
  NORMAL_MAX: SYS_SESSION_BUDGET.session.NORMAL_MAX,
  LANGUAGE_MAX: SYS_SESSION_BUDGET.session.LANGUAGE_MAX,
  NORMAL_TARGET: SYS_SESSION_BUDGET.session.NORMAL_TARGET,
  LANGUAGE_TARGET: SYS_SESSION_BUDGET.session.LANGUAGE_TARGET,
  MARKING_MAX: SYS_SESSION_BUDGET.marking.MAX,
};

/** Misc per-task caps used around the app. */
export const MAX_TOKENS = {
  MARKING_FEEDBACK: SYS_SESSION_BUDGET.marking.MAX, // 700
  ANSWERS_ON_TAP: 700,
  PLAN_BUILDER: 400,
};

/** Super rough token estimate (≈4 chars per token). Good enough for metering. */
export function estimateTokensByChars(s: string) {
  return Math.ceil((s?.length || 0) / 4);
}
