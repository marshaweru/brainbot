"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";

type Cell = { subject: string; topic: string; count: number };

export default function TopicHeatmap({
  wid, selectedSubjects,
}: {
  wid: string;
  selectedSubjects: string[];   // empty = All
}) {
  const [cells, setCells] = useState<Cell[]>([]);
  const [loading, setLoading] = useState(true);

  // cache of tips: key = `${subject}::${topic}` → string
  const tipsRef = useRef<Map<string, string | null>>(new Map());

  useEffect(() => {
    if (!wid) { setLoading(false); return; }
    fetch(`/api/heatmap/${wid}`)
      .then(r => r.json())
      .then(d => setCells(d.cells || []))
      .finally(() => setLoading(false));
  }, [wid]);

  const filtered = useMemo(() => {
    if (selectedSubjects.length === 0) return cells;
    const set = new Set(selectedSubjects);
    return cells.filter(c => set.has(c.subject));
  }, [cells, selectedSubjects]);

  if (loading) return <div className="text-steel-300 text-sm">Loading heatmap…</div>;
  if (!filtered.length) return <div className="text-steel-300 text-sm">No weak-topic data for this filter.</div>;

  const subjects = Array.from(new Set(filtered.map(c => c.subject)));
  const topics = Array.from(new Set(filtered.map(c => c.topic)));
  const matrix = filtered.map(c => [subjects.indexOf(c.subject), topics.indexOf(c.topic), c.count]);

  const option = useMemo(() => ({
    tooltip: {
      position: "top" as const,
      formatter: (p: any) => {
        const s = subjects[p.data[0]];
        const t = topics[p.data[1]];
        const v = p.data[2];
        const key = `${s}::${t}`;
        const tip = tipsRef.current.get(key);
        const tipHtml = tip ? `<br/><i>${tip}</i>` : "";
        return `<b>${s}</b><br/>${t}: <b>${v}</b>${tipHtml}`;
      }
    },
    grid: { left: 90, right: 20, top: 20, bottom: 60 },
    xAxis: {
      type: "category", data: subjects,
      axisLabel: { color: "#cbd5e1" },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.2)" } },
      axisTick: { show: false }
    },
    yAxis: {
      type: "category", data: topics,
      axisLabel: { color: "#cbd5e1" },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.2)" } },
      axisTick: { show: false }
    },
    visualMap: {
      min: 0, max: Math.max(1, ...filtered.map(c => c.count)),
      calculable: true, orient: "horizontal", left: "center", bottom: 0,
      textStyle: { color: "#cbd5e1" }
    },
    series: [{ type: "heatmap", data: matrix, emphasis: { itemStyle: { borderColor: "#fff", borderWidth: 1 } }, progressive: 500 }]
  }), [subjects, topics, filtered, matrix]);

  // lazy-fetch tips as user hovers cells
  const onEvents = useMemo(() => ({
    mouseover: async (e: any) => {
      if (!e?.data) return;
      const s = subjects[e.data[0]];
      const t = topics[e.data[1]];
      const key = `${s}::${t}`;
      if (tipsRef.current.has(key)) return; // cached
      try {
        const url = `/api/insights/by-topic?wid=${encodeURIComponent(wid)}&subject=${encodeURIComponent(s)}&topic=${encodeURIComponent(t)}`;
        const res = await fetch(url);
        const j = await res.json();
        tipsRef.current.set(key, j.tip || null);
      } catch {
        tipsRef.current.set(key, null);
      }
    }
  }), [subjects, topics, wid]);

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 md:p-6">
      <div className="font-bold text-gold-400 mb-2">Weak Topics Heatmap</div>
      <div className="h-72">
        <ReactECharts
          option={option}
          style={{ height: "100%", width: "100%" }}
          notMerge
          onEvents={onEvents}
        />
      </div>
    </div>
  );
}
