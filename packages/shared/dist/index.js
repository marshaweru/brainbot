// Root exports: safe utilities only
export const sharedVersion = "1.0.0";
// Core plan/subject/type utilities
export * from "./plan.js";
export * from "./subjects.js";
export * from "./types/index.js";
export * from "./markingPrompt.js";
// ❌ Do not export DB from here!
// Import DB helpers from "@brainbot/shared/db"
