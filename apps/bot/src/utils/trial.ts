export interface TrialState {
  minutesRemaining: number;   // total across days
  startedAt?: string | null;  // ISO
  claimed?: boolean;          // has the intro been activated
}
export function defaultTrial(): TrialState { return { minutesRemaining: 300, startedAt: null, claimed: false }; }
