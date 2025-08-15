export type PlanCode = "LITE_DAY" | "PRO_WEEK" | "PLUS_MONTH" | "ULTRA_MONTH" | "FIRST100";

export const DAILY_TOKEN_CAP: Record<PlanCode, number> = {
  LITE_DAY:   10_000,
  PRO_WEEK:   10_000,
  PLUS_MONTH: 20_000,
  ULTRA_MONTH:30_000,
  FIRST100:   15_000,
};

export const SESSION_BUDGET = {
  NORMAL_MAX: 800,
  LANGUAGE_MAX: 1200
};

export const MAX_TOKENS = {
  MARKING_FEEDBACK:   500,
  ANSWERS_ON_TAP:     700,
  PLAN_BUILDER:       400,
};

export function estimateTokensByChars(s: string) { return Math.ceil((s?.length || 0) / 4); }
