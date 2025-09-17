// apps/bot/src/state/latest.ts

export type Latest = {
  subjectLabel?: string;
  score?: number;
  gradeText?: string;
  weakTopics?: string[];                    // pdf-export expects string[]
  remarks?: string;
  startedAt?: string | Date;
  finishedAt?: string | Date;
  plan?: "free" | "lite" | "steady" | "serious" | "elite";
};

const cache = new Map<string, Latest>();

export function setLatestFeedback(telegramId: string | number, data: Latest) {
  const key = String(telegramId);
  const prev = cache.get(key) ?? {};
  const wt = Array.isArray(data.weakTopics)
    ? data.weakTopics.map((t: any) => (typeof t === "string" ? t : t?.topic ?? t?.name ?? String(t)))
    : undefined;
  cache.set(key, { ...prev, ...data, ...(wt ? { weakTopics: wt } : {}) });
}

export function getLatestFeedback(telegramId: string | number): Latest | null {
  return cache.get(String(telegramId)) ?? null;
}
