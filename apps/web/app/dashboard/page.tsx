// apps/web/app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import KCSEBadge from "@/components/KCSEBadge";
import StatCard from "@/components/StatCard";
import FilterBar from "@/components/FilterBar";
import TrendLine from "@/components/TrendLine";
import TopicHeatmap from "@/components/TopicHeatmap";
import PDFExport from "@/components/PDFExport";
import Streak from "@/components/Streak";
import DrillsThisWeekCard from "@/components/DrillsThisWeekCard";
import TopTopicsCard from "@/components/TopTopicsCard";

const TG_BOT = "brainbotafrica_bot";

type Stats = { plan: string; papersDone: number; bestScore: number; weakTopics: string[]; lastFinishedAt: string | null; };
type Latest = null | { subjectLabel: string; gradeNumeric: number; gradeText: string; weakTopics: string[]; startedAt?: string; finishedAt?: string; createdAt?: string; };
type ApiResp = { wid: string; linked: boolean; stats: Stats; latest: Latest; };

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [wid, setWid] = useState<string>("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [compare, setCompare] = useState<boolean>(false);
  const [range, setRange] = useState<"90d" | "6mo" | "all">("90d");
  const [pickTopic, setPickTopic] = useState<{ topic: string; total?: number } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const w = typeof window !== "undefined" ? localStorage.getItem("brainbot:wid") || "" : "";
    setWid(w);

    if (!w) { setData(null); setLoading(false); }
    else {
      fetch(`/api/user-stats/${w}`, { cache: "no-store", signal: controller.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((json: ApiResp) => setData(json))
        .catch(() => setData(null))
        .finally(() => setLoading(false));

      fetch(`/api/subjects/${w}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((j) => setSubjects(j.subjects || []))
        .catch(() => setSubjects([]));
    }
    return () => controller.abort();
  }, []);

  const plan = data?.stats.plan ?? "free";
  const last = fmtDate(data?.stats.lastFinishedAt);
  const weak = data?.stats.weakTopics?.length ? data.stats.weakTopics.join(", ") : "—";
  const latestFinish = fmtDate(data?.latest?.finishedAt || data?.latest?.createdAt);

  const handleExport = async () => {
    if (!data) return;
    const latest = data.latest;
    const stats = data.stats;

    const sections = [
      {
        heading: "Summary",
        body: latest
          ? `Subject: ${latest.subjectLabel}
Grade: ${latest.gradeNumeric}/100 (${latest.gradeText})
Weak Topics: ${(latest.weakTopics || []).join(", ") || "—"}
Finished: ${latest.finishedAt || latest.createdAt || "—"}`
          : "No latest report yet. Run a paper to generate feedback.",
      },
      {
        heading: "Performance",
        body: `Papers Done: ${stats.papersDone}
Best Score: ${stats.bestScore}/100
Plan: ${stats.plan}`,
      },
    ];

    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Public": "1" },
        body: JSON.stringify({
          title: "BrainBot Feedback Report",
          sections,
          downloadName: `brainbot-${data.wid}-report`,
          watermark: "BRAINBOT AFRICA",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `brainbot-${data.wid}-report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export failed:", err);
    }
  };

  const drillOnWeb = (topic: string) => router.push(`/drill?topic=${encodeURIComponent(topic)}`);
  const drillInTelegram = (topic: string) => {
    const deep = `https://t.me/${TG_BOT}?start=${encodeURIComponent(`drill_${topic}`)}`;
    window.open(deep, "_blank", "noopener,noreferrer");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 text-white py-10 px-3">
      <div className="glass mx-auto max-w-5xl rounded-2xl shadow-glass p-6 md:p-8">
        <div className="mb-4"><KCSEBadge /></div>

        <div className="flex items-center justify-between mb-3">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gold-500">👋 Your BrainBot Dashboard</h1>
          <div className="text-xs md:text-sm text-white/60">{last ? `Last session: ${last}` : ""}</div>
        </div>

        <div className="text-sm text-white/60 mb-6">
          Plan: <b className="text-gold-400">{plan}</b>{" "}
          {!data?.linked && (
            <span className="ml-2 text-rose-300">
              (Not linked — <Link href="/link" className="underline">link your Telegram</Link>)
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="Papers Attempted" value={loading ? "—" : (data?.stats.papersDone ?? 0)} valueClass="text-gold-400" subtitle="all time" />
          <StatCard title="Best Score" value={loading ? "—" : `${data?.stats.bestScore ?? 0}/100`} valueClass="text-emerald-400" subtitle="personal best" />
          <StatCard title="Weak Topics" value={loading ? "Loading…" : weak} valueClass="text-rose-400 leading-tight" subtitle="needs practice" />
        </div>

        {/* Streak */}
        <div className="mt-4"><Streak wid={wid} /></div>

        {/* Weekly drills + Top topics */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DrillsThisWeekCard />
          <TopTopicsCard />
        </div>

        {/* Latest snapshot strip */}
        <div className="mt-8 rounded-2xl bg-white/[0.03] border border-white/10 p-6">
          {loading ? (
            <div className="animate-pulse text-white/60">Loading latest report…</div>
          ) : data?.latest ? (
            <>
              <div className="font-bold text-gold-400 text-lg mb-1">Latest Report</div>
              <div className="text-sm text-white/60">
                {data.latest.subjectLabel} — {data.latest.gradeNumeric}/100 ({data.latest.gradeText})
              </div>
              {latestFinish && <div className="text-xs text-white/60 mt-1">Finished: {latestFinish}</div>}
              <div className="mt-4 flex gap-4">
                <a href="/session?plan=free" className="rounded-2xl px-6 py-3 text-base font-bold bg-gold-500 text-ink-900 hover:bg-gold-400 inline-block">
                  Start Another Paper
                </a>
                <PDFExport onExport={handleExport} />
              </div>
            </>
          ) : (
            <>
              <div className="font-bold text-gold-400 text-lg mb-2">No reports yet</div>
              <div className="text-sm text-white/60 mb-3">Kick off a full KCSE paper to see analytics here.</div>
              <Link href="/session?plan=free" className="underline text-mint-400">Start Free 3-Hour Session</Link>
            </>
          )}
        </div>

        {/* Filters */}
        <div className="mt-6">
          <FilterBar
            availableSubjects={subjects}
            selectedSubjects={selectedSubjects}
            compare={compare}
            range={range}
            onChange={(next) => {
              if (next.selectedSubjects !== undefined) setSelectedSubjects(next.selectedSubjects);
              if (next.compare !== undefined) setCompare(next.compare);
              if (next.range !== undefined) setRange(next.range);
            }}
          />
        </div>

        {/* Charts */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TrendLine wid={wid} selectedSubjects={selectedSubjects} compare={compare} range={range} />
          <TopicHeatmap wid={wid} selectedSubjects={selectedSubjects} onCellClick={({ topic }) => setPickTopic({ topic })} onTopicClick={({ topic }) => setPickTopic({ topic })} />
        </div>

        {/* Drill chooser */}
        {pickTopic && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm">Ready to drill <b>{pickTopic.topic}</b>? Pick where to practice:</div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => drillOnWeb(pickTopic.topic)} className="rounded-xl px-4 py-2 text-sm font-bold bg-mint-500 text-ink-900 hover:bg-mint-400">Drill on Web</button>
              <button type="button" onClick={() => drillInTelegram(pickTopic.topic)} className="rounded-xl px-4 py-2 text-sm font-bold bg-plum-400 text-ink-900 hover:bg-plum-500">Open in Telegram</button>
              <button type="button" onClick={() => setPickTopic(null)} className="rounded-xl px-3 py-2 text-sm border border-white/15 hover:bg-white/10">Cancel</button>
            </div>
          </div>
        )}

        {/* Upgrade strip */}
        <div className="mt-6 rounded-2xl bg-white/[0.03] border border-white/10 p-6 text-center">
          <div className="font-bold text-gold-400 text-lg mb-2">Upgrade for Unlimited Papers & Extras</div>
          <div className="text-sm text-white/60 mb-3">Unlock audio uploads, PDF export, extra hours, and access to all tiers.</div>
          <a href="/pricing" className="underline text-mint-400">See Plans & Pay Now</a>
        </div>
      </div>
    </main>
  );
}
