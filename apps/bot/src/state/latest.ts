// apps/bot/src/state/latest.ts
type Latest = {
  score?: number;
  gradeText?: string;
  weakTopics?: string[];
  remarks?: string;
  subjectLabel?: string;
  startedAt?: string;
  finishedAt?: string;
  plan?: "free" | "lite" | "steady" | "serious" | "elite";
};

const cache = new Map<string, Latest>();

export function setLatestFeedback(telegramId: string | number, data: Latest) {
  cache.set(String(telegramId), { ...(cache.get(String(telegramId)) || {}), ...data });
}

export function getLatestFeedback(telegramId: string | number): Latest | null {
  return cache.get(String(telegramId)) || null;
}
