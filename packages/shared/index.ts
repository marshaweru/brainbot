// packages/shared/index.ts

// Be explicit to avoid name clashes AND add .js extensions
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
