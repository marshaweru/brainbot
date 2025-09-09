// apps/bot/src/state/latest.ts
import type { Feedback } from "../feedback/render";

const LATEST = new Map<string, Feedback>();

export function setLatestFeedback(uid: string, fb: Feedback) {
  LATEST.set(uid, fb);
}

export function getLatestFeedback(uid: string): Feedback | null {
  return LATEST.get(uid) ?? null;
}
