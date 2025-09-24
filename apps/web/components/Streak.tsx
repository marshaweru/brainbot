// apps/web/components/Streak.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type HeatDay = { date: string; done: boolean };
type Resp =
  | { ok: true; current: number; longest: number; heatmap: HeatDay[] }
  | { ok: false; error: string; current?: number; longest?: number; heatmap?: HeatDay[] };

export default function Streak({ wid }: { wid: string }) {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wid) {
      setData({ ok: false, error: "no wid" });
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    (async () => {
      try {
        const r = await fetch(`/api/streak/${encodeURIComponent(wid)}`, {
          cache: "no-store",
          signal: ac.signal,
        });
        const j = (await r.json()) as Resp;
        setData(j);
      } catch (e: any) {
        setData({ ok: false, error: e?.message || "fetch failed" });
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [wid]);

  const heat = (data && "heatmap" in data && data.heatmap) ? data.heatmap : [];

  const weeks = useMemo(() => {
    // Group into 8 weeks × 7 days columns (Mon→Sun-ish visualization)
    const arr: HeatDay[][] = [];
    for (let i = 0; i < heat.length; i += 7) arr.push(heat.slice(i, i + 7));
    return arr;
  }, [heat]);

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Your Streak</div>
        <div className="text-xs text-white/60">
          {loading
            ? "Loading…"
            : data?.ok
            ? `Current: ${data.current} • Longest: ${data.longest}`
            : "—"}
        </div>
      </div>

      {/* heatmap */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((d, di) => (
              <div
                key={d.date + di}
                title={`${d.date}${d.done ? " • Completed" : ""}`}
                className={`h-3 w-3 rounded-[4px] ${
                  d.done ? "bg-mint-400" : "bg-white/10"
                }`}
              />
            ))}
          </div>
        ))}
      </div>

      {/* hint */}
      <div className="mt-3 text-[11px] text-white/50">
        Do at least one finished session per day to keep your streak alive.
      </div>
    </div>
  );
}
