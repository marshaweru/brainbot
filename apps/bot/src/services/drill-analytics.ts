// apps/bot/src/services/drill-analytics.ts
import { listRecent } from "../repo/drillsRepo.js";

export type DrillTrendPoint = {
  date: string;   // ISO yyyy-mm-dd
  pct: number;    // 0..100
};

export type DrillStats = {
  trend: DrillTrendPoint[];  // newest → oldest (to match your other stats)
  avg14d: number;            // average percent over last 14 days (rounded)
};

const toISO = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(x)));

export async function buildDrillStats(telegramId: string, limit = 200): Promise<DrillStats> {
  const drills = await listRecent({ telegramId, limit });

  // Build per-entry percent and keep newest → oldest ordering (like your exam trend)
  const trend: DrillTrendPoint[] = drills.map((d: any) => {
    const pct = d.outOf > 0 ? (Number(d.score) / Number(d.outOf)) * 100 : 0;
    return { date: toISO(d.createdAt ?? new Date()), pct: clamp(pct) };
  });

  // Average over the last 14 days (by date—not count), newest → oldest already
  const today = new Date();
  const daySet = new Map<string, number[]>(); // date → [pcts today]
  for (const t of trend) {
    const dt = new Date(t.date);
    const ageDays = Math.floor((+today - +dt) / 86400000);
    if (ageDays <= 13) {
      const arr = daySet.get(t.date) ?? [];
      arr.push(t.pct);
      daySet.set(t.date, arr);
    }
  }
  // Average per day, then overall mean
  const dayAverages = Array.from(daySet.values()).map(arr =>
    arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length)
  );
  const avg14d = dayAverages.length
    ? clamp(dayAverages.reduce((a, b) => a + b, 0) / dayAverages.length)
    : 0;

  return { trend, avg14d };
}
