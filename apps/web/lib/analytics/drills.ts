// apps/web/lib/analytics/drills.ts
import { db } from "@/lib/db";

export type WeeklyDrillStats = {
  startISO: string;
  endISO: string;
  byDay: { date: string; count: number }[];
  total: number;
  uniqueUsers: number;
  avgPerUser: number;
  lastWeekTotal: number;
  deltaPct: number;
};

function startOfWeekMonday(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // Monday = 0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - diff);
  return x;
}

/**
 * Weekly stats (Mon→today) with optional subject filter.
 */
export async function getDrillsThisWeek(subject?: string): Promise<WeeklyDrillStats> {
  const database = await db();
  const col = database.collection("drill_logs");

  const now = new Date();
  const start = startOfWeekMonday(now);
  const end = now;

  const matchThisWeek: any = { startedAt: { $gte: start, $lte: end } };
  if (subject) matchThisWeek.subjectLabel = subject;

  // NOTE: no "as const" here — keep it mutable for Mongo types
  const pipeline: any[] = [
    { $match: matchThisWeek },
    {
      $group: {
        _id: {
          y: { $year: "$startedAt" },
          m: { $month: "$startedAt" },
          d: { $dayOfMonth: "$startedAt" },
        },
        count: { $sum: 1 },
        users: { $addToSet: "$telegramId" },
      },
    },
    {
      $project: {
        _id: 0,
        date: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: { $dateFromParts: { year: "$_id.y", month: "$_id.m", day: "$_id.d" } },
          },
        },
        count: 1,
        users: 1,
      },
    },
    { $sort: { date: 1 } },
  ];

  const rows = (await col.aggregate(pipeline).toArray()) as {
    date: string;
    count: number;
    users: string[];
  }[];

  // fill days Mon..today
  const dayMap = new Map(rows.map((r) => [r.date, r.count]));
  const userSet = new Set<string>();
  rows.forEach((r) => r.users?.forEach((u) => userSet.add(u)));

  const byDay: { date: string; count: number }[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const yyyy = cursor.getFullYear();
    const mm = String(cursor.getMonth() + 1).padStart(2, "0");
    const dd = String(cursor.getDate()).padStart(2, "0");
    const key = `${yyyy}-${mm}-${dd}`;
    byDay.push({ date: key, count: dayMap.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  const total = byDay.reduce((s, d) => s + d.count, 0);
  const uniqueUsers = userSet.size;
  const avgPerUser = uniqueUsers ? +(total / uniqueUsers).toFixed(2) : 0;

  // last week range (Mon→Sun before this week)
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - 7);
  const prevEnd = new Date(start);
  prevEnd.setMilliseconds(prevEnd.getMilliseconds() - 1);

  const matchLastWeek: any = { startedAt: { $gte: prevStart, $lte: prevEnd } };
  if (subject) matchLastWeek.subjectLabel = subject;

  const lastWeekTotal = await col.countDocuments(matchLastWeek);

  let deltaPct = 0;
  if (lastWeekTotal === 0) deltaPct = total > 0 ? 100 : 0;
  else deltaPct = Math.round(((total - lastWeekTotal) / lastWeekTotal) * 100);

  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    byDay,
    total,
    uniqueUsers,
    avgPerUser,
    lastWeekTotal,
    deltaPct,
  };
}

/**
 * Top subjects over the last 7 days (for table + filter options).
 */
export async function getSubjectBreakdown7d(limit = 8) {
  const database = await db();
  const col = database.collection("drill_logs");
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const pipeline: any[] = [
    { $match: { startedAt: { $gte: since } } },
    {
      $group: {
        _id: "$subjectLabel",
        drills: { $sum: 1 },
        users: { $addToSet: "$telegramId" },
      },
    },
    { $project: { _id: 0, subject: "$_id", drills: 1, users: { $size: "$users" } } },
    { $sort: { drills: -1 } },
    { $limit: limit },
  ];

  return (await col.aggregate(pipeline).toArray()) as {
    subject: string;
    drills: number;
    users: number;
  }[];
}

/**
 * Hour-of-day histogram (0..23) for the last 7 days.
 * Accepts optional subject filter.
 */
// Top drill topics over the last 7 days
export async function getTopTopics7d(limit = 5) {
  const database = await db();
  const col = database.collection("drill_logs");
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const pipeline: any[] = [
    { $match: { startedAt: { $gte: since } } },
    {
      $group: {
        _id: "$topic",
        count: { $sum: 1 },
        users: { $addToSet: "$telegramId" },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
    { $project: { _id: 0, topic: "$_id", count: 1, users: { $size: "$users" } } },
  ];

  return (await col.aggregate(pipeline).toArray()) as {
    topic: string;
    count: number;
    users: number;
  }[];
}

export async function getHourOfDayHistogram7d(subject?: string) {
  const database = await db();
  const col = database.collection("drill_logs");
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const match: any = { startedAt: { $gte: since } };
  if (subject) match.subjectLabel = subject;

  const pipeline: any[] = [
    { $match: match },
    { $group: { _id: { $hour: "$startedAt" }, count: { $sum: 1 } } },
    { $project: { _id: 0, hour: "$_id", count: 1 } },
    { $sort: { hour: 1 } },
  ];

  const rows = (await col.aggregate(pipeline).toArray()) as { hour: number; count: number }[];

  // fill 0..23
  const map = new Map(rows.map((r) => [r.hour, r.count]));
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, count: map.get(h) ?? 0 }));
}
