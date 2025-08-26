// apps/bot/src/utils/tokenBudget.ts

// Single source of truth for session/marking budgets lives in prompts/system.ts.
// We import from there and re-export a compatible shape for legacy callers.
import { SESSION_BUDGET as SYS_SESSION_BUDGET } from "../prompts/system";

export type PlanCode =
  | "LITE_DAY"
  | "PRO_WEEK"
  | "PLUS_MONTH"
  | "ULTRA_MONTH"
  | "FIRST100";

/** Daily token ceilings per commercial plan (unchanged) */
export const DAILY_TOKEN_CAP: Record<PlanCode, number> = {
  LITE_DAY: 10_000,
  PRO_WEEK: 10_000,
  PLUS_MONTH: 20_000,
  ULTRA_MONTH: 30_000,
  FIRST100: 15_000,
};

/**
 * Session budgets (now mirrored from prompts/system.ts).
 * Kept backward-compatible fields for existing imports:
 *  - NORMAL_MAX / LANGUAGE_MAX
 * Also expose TARGETs + MARKING_MAX for convenience.
 */
export const SESSION_BUDGET = {
  NORMAL_MAX: SYS_SESSION_BUDGET.session.NORMAL_MAX,
  LANGUAGE_MAX: SYS_SESSION_BUDGET.session.LANGUAGE_MAX,
  NORMAL_TARGET: SYS_SESSION_BUDGET.session.NORMAL_TARGET,
  LANGUAGE_TARGET: SYS_SESSION_BUDGET.session.LANGUAGE_TARGET,
  MARKING_MAX: SYS_SESSION_BUDGET.marking.MAX,
};

/**
 * Misc per-task caps used around the app.
 * MARKING_FEEDBACK now mirrors SYSTEM marking cap.
 * Others stay as before (tune as you like).
 */
export const MAX_TOKENS = {
  MARKING_FEEDBACK: SYS_SESSION_BUDGET.marking.MAX, // 700
  ANSWERS_ON_TAP: 700,
  PLAN_BUILDER: 400,
};

/** Super rough token estimate (≈4 chars per token). Good enough for metering. */
export function estimateTokensByChars(s: string) {
  return Math.ceil((s?.length || 0) / 4);
}
