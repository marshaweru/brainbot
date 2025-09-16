"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import KCSEBadge from "@/components/KCSEBadge";
import StatCard from "@/components/StatCard";
import FilterBar from "@/components/FilterBar";
import TrendLine from "@/components/TrendLine";
import TopicHeatmap from "@/components/TopicHeatmap";

type Stats = {
  plan: string;
  papersDone: number;
  bestScore: number;
  weakTopics: string[];
  lastFinishedAt: string | null; // ISO
};

type Latest = null | {
  subjectLabel: string;
  gradeNumeric: number;
  gradeText: string;
  weakTopics: string[];
  startedAt?: string;
  finishedAt?: string;
  createdAt?: string; // fallback if finishedAt not yet stamped
};

type ApiResp = {
  wid: string;
  linked: boolean;
  stats: Stats;
  latest: Latest;
};

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Dashboard() {
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);

  const [wid, setWid] = useState<string>("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [compare, setCompare] = useState<boolean>(false);
  const [range, setRange] = useState<"90d" | "6mo" | "all">("90d");

  useEffect(() => {
    const controller = new AbortController();
    const w =
      typeof window !== "undefined"
        ? localStorage.getItem("brainbot:wid") || ""
        : "";

    setWid(w);

    if (!w) {
      setData(null);
      setLoading(false);
      return;
    }

    fetch(`/api/user-stats/${w}`, { cache: "no-store", signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json: ApiResp) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));

    fetch(`/api/subjects/${w}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => setSubjects(j.subjects || []))
      .catch(() => setSubjects([]));

    return () => controller.abort();
  }, []);

  const plan = data?.stats.plan ?? "free";
  const last = fmtDate(data?.stats.lastFinishedAt);
  const weak = data?.stats.weakTopics?.length
    ? data.stats.weakTopics.join(", ")
    : "—";
  const latestFinish = fmtDate(
    data?.latest?.finishedAt || data?.latest?.createdAt
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 text-white py-10 px-3">
      <div className="glass mx-auto max-w-5xl rounded-2xl shadow-glass p-6 md:p-8">
        <div className="mb-4">
          <KCSEBadge />
        </div>

        <div className="flex items-center justify-between mb-3">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gold-500">
            👋 Your BrainBot Dashboard
          </h1>
          <div className="text-xs md:text-sm text-steel-300">
            {last ? `Last session: ${last}` : ""}
          </div>
        </div>

        <div className="text-sm text-steel-300 mb-6">
          Plan: <b className="text-gold-400">{plan}</b>{" "}
          {!data?.linked && (
            <span className="ml-2 text-rose-300">
              (Not linked —{" "}
              <Link href="/link" className="underline">
                link your Telegram
              </Link>
              )
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Papers Attempted"
            value={loading ? "—" : (data?.stats.papersDone ?? 0)}
            valueClass="text-gold-400"
          />
          <StatCard
            title="Best Score"
            value={loading ? "—" : `${data?.stats.bestScore ?? 0}/100`}
            valueClass="text-emerald-400"
          />
          <StatCard
            title="Weak Topics"
            value={loading ? "Loading…" : weak}
            valueClass="text-rose-400 leading-tight"
          />
        </div>

        {/* Latest snapshot strip */}
        <div className="mt-8 rounded-2xl bg-white/[0.03] border border-white/10 p-6">
          {loading ? (
            <div className="animate-pulse text-steel-300">
              Loading latest report…
            </div>
          ) : data?.latest ? (
            <>
              <div className="font-bold text-gold-400 text-lg mb-1">
                Latest Report
              </div>
              <div className="text-sm text-steel-300">
                {data.latest.subjectLabel} — {data.latest.gradeNumeric}/100 (
                {data.latest.gradeText})
              </div>
              {latestFinish && (
                <div className="text-xs text-steel-300 mt-1">
                  Finished: {latestFinish}
                </div>
              )}
              <div className="mt-4">
                <a
                  href="/session?plan=free"
                  className="rounded-2xl px-6 py-3 text-base font-bold bg-gold-500 text-ink-900 hover:bg-gold-400 inline-block"
                >
                  Start Another Paper
                </a>
              </div>
            </>
          ) : (
            <>
              <div className="font-bold text-gold-400 text-lg mb-2">
                No reports yet
              </div>
              <div className="text-sm text-steel-300 mb-3">
                Kick off a full KCSE paper to see analytics here.
              </div>
              <Link href="/session?plan=free" className="underline text-mint-400">
                Start Free 3-Hour Session
              </Link>
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
              if (next.selectedSubjects !== undefined)
                setSelectedSubjects(next.selectedSubjects);
              if (next.compare !== undefined) setCompare(next.compare);
              if (next.range !== undefined) setRange(next.range);
            }}
          />
        </div>

        {/* Charts */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TrendLine
            wid={wid}
            selectedSubjects={selectedSubjects}
            compare={compare}
            range={range}
          />
          <TopicHeatmap wid={wid} selectedSubjects={selectedSubjects} />
        </div>

        {/* Upgrade strip */}
        <div className="mt-6 rounded-2xl bg-white/[0.03] border border-white/10 p-6 text-center">
          <div className="font-bold text-gold-400 text-lg mb-2">
            Upgrade for Unlimited Papers & Extras
          </div>
          <div className="text-sm text-steel-300 mb-3">
            Unlock audio uploads, PDF export, extra hours, and access to all tiers.
          </div>
          <a href="/#pricing" className="underline text-mint-400">
            See Plans & Pay Now
          </a>
        </div>
      </div>
    </main>
  );
}
