/** Session-based free trial (2 sessions total, lifetime) */
export interface TrialState {
  sessionsRemaining: number;
  startedAt?: string | null;
  claimed?: boolean;
}

export const DEFAULT_TRIAL_SESSIONS = 2;

export function defaultTrial(): TrialState {
  return { sessionsRemaining: DEFAULT_TRIAL_SESSIONS, startedAt: null, claimed: false };
}

export function normalizeTrial(input: any): TrialState {
  if (!input || typeof input !== "object") return defaultTrial();

  if (typeof input.sessionsRemaining === "number") {
    const n = Math.max(0, Math.floor(input.sessionsRemaining));
    return {
      sessionsRemaining: n,
      startedAt: input.startedAt ?? null,
      claimed: Boolean(input.claimed),
    };
  }

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

export function hasFreeSessions(state: TrialState): boolean {
  return (state?.sessionsRemaining ?? 0) > 0;
}

export function claimTrial(state: TrialState): TrialState {
  const nowIso = new Date().toISOString();
  return {
    ...state,
    claimed: true,
    startedAt: state.startedAt ?? nowIso,
  };
}

export function consumeOneSession(state: TrialState): TrialState {
  const remaining = Math.max(0, (state.sessionsRemaining ?? 0) - 1);
  return {
    ...state,
    sessionsRemaining: remaining,
    claimed: true,
    startedAt: state.startedAt ?? new Date().toISOString(),
  };
}
