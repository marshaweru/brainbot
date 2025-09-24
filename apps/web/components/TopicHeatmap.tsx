// apps/web/components/TopicHeatmap.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";

type Cell = { subject: string; topic: string; count: number };

type Props = {
  wid: string;
  selectedSubjects: string[];                 // empty = All
  className?: string;
  title?: string;
  onCellClick?: (cell: { subject: string; topic: string; count: number }) => void;
  onTopicClick?: (topic: { topic: string; total: number }) => void; // Top 5 handler
  maxTopics?: number;                         // cap chart topic rows for readability
};

export default function TopicHeatmap({
  wid,
  selectedSubjects,
  className = "",
  title = "Weak Topics Heatmap",
  onCellClick,
  onTopicClick,
  maxTopics,
}: Props) {
  const [cells, setCells] = useState<Cell[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // cache of tips: key = `${subject}::${topic}` → string
  const tipsRef = useRef<Map<string, string | null>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  // fetch data
  useEffect(() => {
    if (!wid) {
      setCells([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    (async () => {
      try {
        const r = await fetch(`/api/heatmap/${encodeURIComponent(wid)}`, {
          cache: "no-store",
          signal: ac.signal,
        });
        const j = await r.json();
        const data = Array.isArray(j?.cells) ? (j.cells as Cell[]) : [];
        setCells(data);
      } catch (e: any) {
        if (e?.name !== "AbortError") setErr("Could not load heatmap");
        setCells([]);
      } finally {
        setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [wid]);

  // filter by subject
  const filtered = useMemo(() => {
    if (!selectedSubjects?.length) return cells;
    const set = new Set(selectedSubjects);
    return cells.filter((c) => set.has(c.subject));
  }, [cells, selectedSubjects]);

  // derive axes with stable ordering
  const { subjects, topics } = useMemo(() => {
    const subj = Array.from(new Set(filtered.map((c) => c.subject))).sort((a, b) =>
      a.localeCompare(b)
    );

    const topicCounts = new Map<string, number>();
    for (const c of filtered) topicCounts.set(c.topic, (topicCounts.get(c.topic) || 0) + c.count);
    const top = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);

    const trimmed = typeof maxTopics === "number" && maxTopics > 0 ? top.slice(0, maxTopics) : top;
    return { subjects: subj, topics: trimmed };
  }, [filtered, maxTopics]);

  // matrix for chart
  const matrix = useMemo(() => {
    const si = new Map(subjects.map((s, i) => [s, i]));
    const ti = new Map(topics.map((t, i) => [t, i]));
    const data: [number, number, number][] = [];
    for (const c of filtered) {
      const x = si.get(c.subject);
      const y = ti.get(c.topic);
      if (x == null || y == null) continue;
      data.push([x, y, c.count]);
    }
    return data;
  }, [subjects, topics, filtered]);

  const maxV = useMemo(
    () => Math.max(1, ...filtered.map((c) => c.count)),
    [filtered]
  );

  // top 5 topics (aggregated across subjects)
  const top5 = useMemo(() => {
    const agg = new Map<string, number>();
    for (const c of filtered) agg.set(c.topic, (agg.get(c.topic) || 0) + c.count);
    return Array.from(agg.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, total]) => ({ topic, total }));
  }, [filtered]);

  if (loading) {
    return (
      <Frame className={className} title={title}>
        <p className="text-white/60 text-sm">Loading heatmap…</p>
      </Frame>
    );
  }
  if (err) {
    return (
      <Frame className={className} title={title}>
        <p className="text-rose-300 text-sm">{err}</p>
      </Frame>
    );
  }
  if (!filtered.length || !subjects.length || !topics.length) {
    return (
      <Frame className={className} title={title}>
        <p className="text-white/60 text-sm">No weak-topic data for this filter.</p>
      </Frame>
    );
  }

  const option = {
    tooltip: {
      position: "top" as const,
      confine: true,
      formatter: (p: any) => {
        const s = subjects[p.data[0]];
        const t = topics[p.data[1]];
        const v = p.data[2];
        const key = `${s}::${t}`;
        const tip = tipsRef.current.get(key);
        const tipHtml = tip ? `<br/><i>${escapeHtml(tip)}</i>` : "";
        return `<b>${escapeHtml(s)}</b><br/>${escapeHtml(t)}: <b>${v}</b>${tipHtml}`;
      },
    },
    grid: { left: 100, right: 20, top: 20, bottom: 60, containLabel: false },
    xAxis: {
      type: "category",
      data: subjects,
      axisLabel: { color: "#cbd5e1", rotate: 30 },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.2)" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "category",
      data: topics,
      axisLabel: { color: "#cbd5e1" },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.2)" } },
      axisTick: { show: false },
    },
    visualMap: {
      min: 0,
      max: maxV,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      textStyle: { color: "#cbd5e1" },
    },
    series: [
      {
        type: "heatmap",
        data: matrix,
        emphasis: { itemStyle: { borderColor: "#fff", borderWidth: 1 } },
        progressive: 800,
      },
    ],
    animation: true,
  };

  const onEvents = {
    mouseover: async (e: any) => {
      if (!e?.data) return;
      const s = subjects[e.data[0]];
      const t = topics[e.data[1]];
      if (!s || !t) return;
      const key = `${s}::${t}`;
      if (tipsRef.current.has(key)) return; // cached
      try {
        const url =
          `/api/insights/by-topic?wid=${encodeURIComponent(wid)}` +
          `&subject=${encodeURIComponent(s)}&topic=${encodeURIComponent(t)}`;
        const res = await fetch(url, { cache: "no-store" });
        const j = await res.json();
        tipsRef.current.set(key, j?.tip || null);
      } catch {
        tipsRef.current.set(key, null);
      }
    },
    click: (e: any) => {
      if (!onCellClick || !e?.data) return;
      const s = subjects[e.data[0]];
      const t = topics[e.data[1]];
      const v = e.data[2];
      if (s && t) onCellClick({ subject: s, topic: t, count: v });
    },
  };

  return (
    <Frame className={className} title={title} rightHint={!!maxTopics ? `Top ${maxTopics} topics` : undefined}>
      <div className="h-72 mb-3">
        <ReactECharts option={option} style={{ height: "100%", width: "100%" }} notMerge onEvents={onEvents as any} />
      </div>

      {/* Top 5 list */}
      <div className="mt-1">
        <div className="text-xs text-white/60 mb-1">Top weak topics</div>
        <ul className="divide-y divide-white/10 rounded-xl border border-white/10 overflow-hidden">
          {top5.map((t, i) => (
            <li
              key={t.topic}
              className="flex items-center justify-between px-3 py-2 bg-white/[0.02] hover:bg-white/[0.05] transition"
            >
              <div className="flex items-center gap-2">
                <span className="text-white/50 text-xs w-5 text-right tabular-nums">{i + 1}.</span>
                <span className="text-sm">{t.topic}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/60 tabular-nums">×{t.total}</span>
                <button
                  type="button"
                  onClick={() => onTopicClick?.(t)}
                  className="text-xs rounded-lg border border-white/15 px-2 py-1 text-white/80 hover:bg-white/10"
                >
                  Drill
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  );
}

/* — helpers — */
function Frame({
  children,
  className,
  title,
  rightHint,
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
  rightHint?: string;
}) {
  return (
    <div className={`rounded-2xl bg-white/[0.03] border border-white/10 p-4 md:p-6 ${className || ""}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold text-gold-400">{title}</div>
        {rightHint && <div className="text-[11px] text-white/50">{rightHint}</div>}
      </div>
      {children}
    </div>
  );
}

function escapeHtml(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
