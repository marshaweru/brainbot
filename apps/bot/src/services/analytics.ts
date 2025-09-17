// apps/bot/src/services/analytics.ts
import { listRecent } from "../repo/performanceRepo.js";
import { SUBJECTS } from "../subjects.js";

export type TrendPoint = {
  date: string;          // ISO yyyy-mm-dd
  grade: number;         // 0..100
  subjectLabel: string;  // e.g., "Mathematics"
};

export type HeatItem = {
  topic: string;
  count: number;
};

export type TopSubject = {
  subjectLabel: string;
  count: number;      // sessions counted
  first: number;      // earliest grade
  latest: number;     // most recent grade
  avg: number;        // average grade
  delta: number;      // latest - first
};

export type UserStats = {
  trend: TrendPoint[];
  heat: HeatItem[];
  consistency: number;   // 0..100 (% of days with study in last 14 days)
  streakDays: number;    // consecutive days up to today
  subjectLabel?: string | null; // normalized label when filtering
};

const toISODate = (d: Date | string): string =>
  new Date(d).toISOString().slice(0, 10);

const clamp0to100 = (n: number): number =>
  Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));

function normalizeSubjectLabel(input?: string | null): string | null {
  if (!input) return null;
  const lower = input.toLowerCase();
  const arr = SUBJECTS as any[];
  const bySlug = arr.find(s => s?.slug?.toLowerCase?.() === lower);
  if (bySlug) return bySlug.label ?? String(bySlug);
  const byLabel = arr.find(s => s?.label?.toLowerCase?.() === lower);
  if (byLabel) return byLabel.label ?? String(byLabel);
  const byString = arr.find(s => String(s).toLowerCase() === lower);
  return byString ? String(byString) : null;
}

export async function buildUserStats(
  telegramId: string,
  opts?: { limit?: number; subject?: string | null }
): Promise<UserStats> {
  const limit = opts?.limit ?? 100;
  const subjectFilter = normalizeSubjectLabel(opts?.subject ?? null);

  const sessions = await listRecent(telegramId, limit);

  const filtered = subjectFilter
    ? sessions.filter((s: any) => String(s?.subjectLabel ?? "").toLowerCase() === subjectFilter.toLowerCase())
    : sessions;

  const trend: TrendPoint[] = filtered.map((s: any) => ({
    date: toISODate(s?.createdAt ?? s?.startedAt ?? new Date()),
    grade: clamp0to100(Number(s?.gradeNumeric ?? 0)),
    subjectLabel: String(s?.subjectLabel ?? "—"),
  }));

  const freq = new Map<string, number>();
  for (const s of filtered) {
    const topics: string[] = Array.isArray((s as any).weakTopics) ? (s as any).weakTopics : [];
    for (const t of topics) {
      const key = String(t).trim();
      if (!key) continue;
      freq.set(key, (freq.get(key) ?? 0) + 1);
    }
  }
  const heat: HeatItem[] = Array.from(freq.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count);

  const windowDays = 14;
  const today = new Date();
  const daySet = new Set(trend.map(t => t.date));

  let studiedDays = 0;
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (daySet.has(toISODate(d))) studiedDays++;
  }
  const consistency = clamp0to100((studiedDays / windowDays) * 100);

  let streakDays = 0;
  while (true) {
    const d = new Date(today);
    d.setDate(today.getDate() - streakDays);
    if (daySet.has(toISODate(d))) streakDays++;
    else break;
  }

  return { trend, heat, consistency, streakDays, subjectLabel: subjectFilter };
}

/** Compute best-improving subjects. */
export async function buildTopSubjects(
  telegramId: string,
  opts?: { limit?: number; minSessions?: number }
): Promise<TopSubject[]> {
  const limit = opts?.limit ?? 200;
  const minSessions = Math.max(2, opts?.minSessions ?? 2);

  const sessions = await listRecent(telegramId, limit);
  // group by subjectLabel
  const bySubject = new Map<string, Array<any>>();
  for (const s of sessions) {
    const label = String((s as any).subjectLabel ?? "—");
    if (!bySubject.has(label)) bySubject.set(label, []);
    bySubject.get(label)!.push(s);
  }

  const out: TopSubject[] = [];
  for (const [subjectLabel, arr] of bySubject.entries()) {
    if (arr.length < minSessions) continue;
    // newest first; reverse to oldest→newest to compute first/latest deterministically
    const chron = [...arr].reverse();
    const grades = chron.map((s: any) => clamp0to100(Number(s?.gradeNumeric ?? 0)));
    const first = grades[0] ?? 0;
    const latest = grades[grades.length - 1] ?? 0;
    const avg = Math.round(grades.reduce((a, b) => a + b, 0) / grades.length);
    const delta = latest - first;
    out.push({ subjectLabel, count: arr.length, first, latest, avg, delta });
  }

  // sort by delta desc, tie-break by latest desc
  out.sort((a, b) => (b.delta - a.delta) || (b.latest - a.latest));
  return out;
}
// analytics placeholder
