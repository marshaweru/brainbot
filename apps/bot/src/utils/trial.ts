// apps/bot/src/utils/trial.ts

/** Session-based free trial (2 sessions total, lifetime) */
export interface TrialState {
  /** How many free sessions are left to consume (lifetime, not per-day) */
  sessionsRemaining: number;
  /** ISO timestamp when the trial was first claimed/started (optional) */
  startedAt?: string | null;
  /** Has the user explicitly activated/claimed the trial? */
  claimed?: boolean;
}

/** Default: 2 free sessions */
export const DEFAULT_TRIAL_SESSIONS = 2;

/** Create a fresh trial state */
export function defaultTrial(): TrialState {
  return { sessionsRemaining: DEFAULT_TRIAL_SESSIONS, startedAt: null, claimed: false };
}

/**
 * Normalize any old minute-based trial state into the new session-based shape.
 * If a legacy object has minutesRemaining > 0, we grant the full 2 sessions.
 */
export function normalizeTrial(input: any): TrialState {
  if (!input || typeof input !== "object") return defaultTrial();

  // Already in new shape
  if (typeof input.sessionsRemaining === "number") {
    const n = Math.max(0, Math.floor(input.sessionsRemaining));
    return {
      sessionsRemaining: n,
      startedAt: input.startedAt ?? null,
      claimed: Boolean(input.claimed),
    };
  }

  // Legacy: minutesRemaining → sessionsRemaining (coarse but generous)
  if (typeof input.minutesRemaining === "number") {
    const hasMinutes = input.minutesRemaining > 0;
    return {
      sessionsRemaining: hasMinutes ? DEFAULT_TRIAL_SESSIONS : 0,
      startedAt: input.startedAt ?? null,
      claimed: Boolean(input.claimed),
    };
  }

  return defaultTrial();
}

/** True if the user still has any free sessions left */
export function hasFreeSessions(state: TrialState): boolean {
  return (state?.sessionsRemaining ?? 0) > 0;
}

/** Mark trial as claimed (sets startedAt if not already set) */
export function claimTrial(state: TrialState): TrialState {
  const nowIso = new Date().toISOString();
  return {
    ...state,
    claimed: true,
    startedAt: state.startedAt ?? nowIso,
  };
}

/** Consume one free session (no negative underflow). Returns the updated state. */
export function consumeOneSession(state: TrialState): TrialState {
  const remaining = Math.max(0, (state.sessionsRemaining ?? 0) - 1);
  return {
    ...state,
    sessionsRemaining: remaining,
    claimed: true,
    startedAt: state.startedAt ?? new Date().toISOString(),
  };
}
