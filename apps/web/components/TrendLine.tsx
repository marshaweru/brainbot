// apps/web/components/TrendLine.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

type TrendPoint = { t: string; s: string; y: number };
type Range = "90d" | "6mo" | "all";

function daysBack(range: Range) {
  return range === "all" ? Infinity : range === "90d" ? 90 : 180;
}
function toLocalDateKey(iso: string) {
  // Stable per-day key that won’t flip with locale differences
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function inRange(iso: string, range: Range) {
  if (range === "all") return true;
  const now = Date.now();
  const dt = new Date(iso).getTime();
  return dt >= now - daysBack(range) * 24 * 3600 * 1000;
}

export default function TrendLine({
  wid,
  selectedSubjects,
  compare,
  range,
}: {
  wid: string;
  selectedSubjects: string[]; // empty = All
  compare: boolean;
  range: Range;
}) {
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!wid) {
      setPoints([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setErr(null);
    fetch(`/api/trends/${wid}`, { signal: ctrl.signal, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => setPoints(Array.isArray(d.points) ? d.points : []))
      .catch((e) => {
        if (e.name !== "AbortError") setErr(String(e?.message || e));
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [wid]);

  const filtered = useMemo(() => {
    const allowAll = selectedSubjects.length === 0;
    return points.filter(
      (p) => inRange(p.t, range) && (allowAll || selectedSubjects.includes(p.s))
    );
  }, [points, selectedSubjects, range]);

  // Build x-axis by stable date key; compose series by subject if compare==true
  const { rows, subjects, dateLabels } = useMemo(() => {
    if (filtered.length === 0) return { rows: [] as any[], subjects: [] as string[], dateLabels: new Map<string, string>() };

    const subs = Array.from(new Set(filtered.map((p) => p.s)));

    // Order dates ascending, keep a pretty label per key
    const keySet = new Set(filtered.map((p) => toLocalDateKey(p.t)));
    const keys = Array.from(keySet).sort(); // YYYY-MM-DD sorts lexicographically
    const dateLabels = new Map<string, string>();
    for (const k of keys) {
      const d = new Date(k + "T00:00:00");
      dateLabels.set(k, d.toLocaleDateString(undefined, { month: "short", day: "2-digit" }));
    }

    // Group points by day+subject, pick the *latest* per day/subject
    const latestByDaySub = new Map<string, TrendPoint>();
    for (const p of filtered) {
      const key = `${toLocalDateKey(p.t)}__${p.s}`;
      const prev = latestByDaySub.get(key);
      if (!prev || new Date(p.t).getTime() >= new Date(prev.t).getTime()) {
        latestByDaySub.set(key, p);
      }
    }

    const rows = keys.map((k) => {
      const row: Record<string, any> = { dateKey: k, date: dateLabels.get(k)! };
      for (const s of subs) {
        const pt = latestByDaySub.get(`${k}__${s}`);
        row[s] = pt ? clamp100(pt.y) : undefined;
      }
      // single-series mode: pick the latest point across all subjects for that day
      const dayLatest = subs
        .map((s) => latestByDaySub.get(`${k}__${s}`))
        .filter(Boolean)
        .sort((a, b) => new Date((a as TrendPoint).t).getTime() - new Date((b as TrendPoint).t).getTime())
        .at(-1) as TrendPoint | undefined;
      row.score = dayLatest ? clamp100(dayLatest.y) : undefined;
      return row;
    });

    return { rows, subjects: subs, dateLabels };
  }, [filtered]);

  if (loading) return <div className="text-steel-300 text-sm">Loading trend…</div>;
  if (err) return <div className="text-rose-300 text-sm">Failed to load trend: {err}</div>;
  if (!rows.length) return <div className="text-steel-300 text-sm">No sessions for this filter.</div>;

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 md:p-6">
      <div className="font-bold text-gold-400 mb-2">Grade Trend</div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid strokeOpacity={0.15} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              minTickGap={16}
            />
            <YAxis domain={[0, 100]} tickCount={6} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: any) => (typeof value === "number" ? `${value}/100` : value)}
              labelFormatter={(label: any, payload: any) => String(label)}
            />
            {compare && <Legend />}
            {compare
              ? subjects.map((s) => (
                  <Line
                    key={s}
                    type="monotone"
                    dataKey={s}
                    name={s}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))
              : (
                <Line
                  type="monotone"
                  dataKey="score"
                  name="Score"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function clamp100(n: number) {
  return Math.max(0, Math.min(100, n));
}
