// apps/web/components/DrillsThisWeekCard.tsx
"use client";
import { useEffect, useMemo, useState } from "react";

type Pt = { date: string; count: number };
type Payload = {
  ok: boolean;
  data?: {
    byDay: Pt[];
    total: number;
    uniqueUsers: number;
    avgPerUser: number;
    startISO: string;
    endISO: string;
    lastWeekTotal: number;
    deltaPct: number;
  };
  error?: string;
};

export default function DrillsThisWeekCard() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/analytics/drills-weekly", { cache: "no-store" });
        const j = (await r.json()) as Payload;
        if (alive) setPayload(j);
      } catch (e) {
        if (alive) setPayload({ ok: false, error: String(e) });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const points = payload?.data?.byDay ?? [];
  const maxY = Math.max(1, ...points.map((p) => p.count));
  const pathD = useMemo(() => spark(points.map((p) => p.count), 240, 48, maxY), [points, maxY]);

  const delta = payload?.data?.deltaPct ?? 0;
  const thisWeek = payload?.data?.total ?? 0;
  const lastWeek = payload?.data?.lastWeekTotal ?? 0;
  const deltaSign = delta > 0 ? "▲" : delta < 0 ? "▼" : "•";
  const deltaClass =
    delta > 0 ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" :
    delta < 0 ? "text-rose-300 bg-rose-300/10 border-rose-300/30" :
                "text-white/70 bg-white/10 border-white/20";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-white/90">Drills this week</h3>
        <div className="flex items-center gap-3">
          {!loading && payload?.data && (
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full border ${deltaClass}`}
              title={`This week ${thisWeek} vs last week ${lastWeek}`}
            >
              {deltaSign} {Math.abs(delta)}% vs last week
            </span>
          )}
          {!loading && payload?.data && (
            <span className="text-xs text-white/50">
              {fmtDate(payload.data.startISO)} – {fmtDate(payload.data.endISO)}
            </span>
          )}
          <a href="/analytics" className="text-[11px] text-mint-300 hover:text-mint-200 underline underline-offset-2">
            View details →
          </a>
        </div>
      </div>

      <div className="h-16">
        <svg viewBox="0 0 240 48" className="w-full h-full text-mint-400">
          <path d={pathD.grid} fill="none" stroke="currentColor" opacity="0.15" />
          <path d={pathD.line} fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        <Stat label="Total" value={payload?.data?.total ?? 0} />
        <Stat label="Students" value={payload?.data?.uniqueUsers ?? 0} />
        <Stat label="Avg / user" value={payload?.data?.avgPerUser ?? 0} />
      </div>

      {loading && <p className="mt-3 text-xs text-white/50">Loading…</p>}
      {!loading && !payload?.ok && <p className="mt-3 text-xs text-rose-300">Failed to load: {payload?.error}</p>}
      {!loading && payload?.ok && (payload?.data?.total ?? 0) === 0 && (
        <p className="mt-3 text-xs text-white/50">No drills yet this week. Let’s light it up. 🔥</p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/5 py-2">
      <div className="text-lg font-bold text-white">{Number.isFinite(value) ? value : "-"}</div>
      <div className="text-[11px] text-white/60">{label}</div>
    </div>
  );
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function spark(vals: number[], w: number, h: number, maxY: number) {
  const n = Math.max(vals.length, 1);
  const step = n > 1 ? w / (n - 1) : 0;
  const toY = (v: number) => h - (h * v) / (maxY || 1);
  const pts: [number, number][] = vals.map((v, i) => [i * step, toY(v)]);
  if (pts.length === 0) pts.push([0, toY(0)], [w, toY(0)]);
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0]} ${pts[i][1]}`;
  const grid = `M 0 ${toY(0)} L ${w} ${toY(0)} M 0 ${toY(maxY)} L ${w} ${toY(maxY)}`;
  return { line: d, grid };
}
