// Root exports: safe utilities only.
// Always add explicit .js extensions to keep Node ESM happy.

export {
  PLANS,
  PLAN_LABELS,
  PLAN_PRICES_KES,
  PLAN_LIMITS,
  planFromAmount,
  getUserPlan,
  upgradeUserPlan,
} from "./plan.js";
export type { PlanTier, PlanDetails, UserPlan } from "./plan.js";

export { SUBJECTS } from "./subjects.js";
export type { SubjectSlug, SubjectLabel, SubjectName } from "./subjects.js";

export * from "./markingPrompt.js";
export * from "./types.js";

// 🚫 Do NOT export DB helpers here!
// Use `import { getDb } from "@brainbot/shared/db"` instead.
