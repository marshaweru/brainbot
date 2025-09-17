// apps/bot/src/state/latest.ts
import type { Feedback } from "../feedback/render.js";

// Keep the cache shape identical to the Feedback we render/export
export type Latest = Feedback;

const cache = new Map<string, Latest>();

export function setLatestFeedback(telegramId: string | number, data: Feedback) {
  cache.set(String(telegramId), data);
}

export function getLatestFeedback(telegramId: string | number): Latest | null {
  return cache.get(String(telegramId)) ?? null;
}
