"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

type TrendPoint = { t: string; s: string; y: number };
type Range = "90d" | "6mo" | "all";

function inRange(iso: string, range: Range) {
  if (range === "all") return true;
  const now = Date.now();
  const dt = new Date(iso).getTime();
  const days = range === "90d" ? 90 : 180;
  return dt >= now - days * 24 * 3600 * 1000;
}

export default function TrendLine({
  wid, selectedSubjects, compare, range,
}: {
  wid: string;
  selectedSubjects: string[];   // empty = All
  compare: boolean;
  range: Range;
}) {
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wid) { setLoading(false); return; }
    fetch(`/api/trends/${wid}`)
      .then(r => r.json())
      .then(d => setPoints(d.points || []))
      .finally(() => setLoading(false));
  }, [wid]);

  const filtered = useMemo(() => {
    const allowAll = selectedSubjects.length === 0;
    return points.filter(p =>
      inRange(p.t, range) && (allowAll || selectedSubjects.includes(p.s))
    );
  }, [points, selectedSubjects, range]);

  if (loading) return <div className="text-steel-300 text-sm">Loading trend…</div>;
  if (!filtered.length) return <div className="text-steel-300 text-sm">No sessions for this filter.</div>;

  // Build x-axis by date; then compose series by subject if compare==true
  const dates = Array.from(new Set(filtered.map(p => new Date(p.t).toLocaleDateString())));
  const subjects = Array.from(new Set(filtered.map(p => p.s)));

  const rows = dates.map(d => {
    const row: any = { date: d };
    for (const s of subjects) {
      const pt = filtered.filter(p => new Date(p.t).toLocaleDateString() === d && p.s === s).at(-1);
      row[s] = pt ? Math.max(0, Math.min(100, pt.y)) : undefined;
    }
    // also provide a single "score" (latest across subjects) for the non-compare view
    const latest = filtered.filter(p => new Date(p.t).toLocaleDateString() === d).at(-1);
    row.score = latest ? Math.max(0, Math.min(100, latest.y)) : undefined;
    return row;
  });

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 md:p-6">
      <div className="font-bold text-gold-400 mb-2">Grade Trend</div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid strokeOpacity={0.15} />
            <XAxis dataKey="date" />
            <YAxis domain={[0, 100]} tickCount={6} />
            <Tooltip />
            <Legend />
            {compare
              ? subjects.map((s) => (
                  <Line key={s} type="monotone" dataKey={s} name={s} strokeWidth={2} dot={false} />
                ))
              : <Line type="monotone" dataKey="score" name="Score" strokeWidth={2} dot={false} />
            }
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
