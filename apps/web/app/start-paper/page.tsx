// apps/web/app/start-paper/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import KCSEBadge from "@/components/KCSEBadge";

const TG_BOT = "brainbotafrica_bot";
const SUBJECTS = [
  "Mathematics", "English", "Kiswahili",
  "Biology", "Chemistry", "Physics",
  "History & Government", "Geography", "CRE",
  "Business Studies",
] as const;

const PLANS = ["free", "lite", "steady", "serious", "elite", "limited"] as const;
type PlanKey = (typeof PLANS)[number];

function toPlanKey(v: unknown): PlanKey {
  const s = String(v ?? "free").toLowerCase();
  return (PLANS as readonly string[]).includes(s) ? (s as PlanKey) : "free";
}

export default function StartPaperPage() {
  // Allow ?plan=… override (defaults to free)
  const plan = useMemo<PlanKey>(() => {
    const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : undefined;
    return toPlanKey(q?.get("plan"));
  }, []);

  const [subject, setSubject] = useState<string>("");
  const [paper, setPaper] = useState<"1" | "2" | "3" | "">("");
  const [startParam, setStartParam] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);

  // Ensure persistent wid
  useEffect(() => {
    try {
      let wid = localStorage.getItem("brainbot:wid") || "";
      if (!wid) {
        wid = crypto.randomUUID();
        localStorage.setItem("brainbot:wid", wid);
      }
    } catch {
      // ignore storage failures
    }
  }, []);

  const canStart = !!subject && !!paper && !loading;

  const buildAndOpen = async () => {
    if (!canStart) return;
    setLoading(true);
    setErr(null);
    try {
      // Keep wid stable (re-read in case it changed)
      let wid = "";
      try { wid = localStorage.getItem("brainbot:wid") || ""; } catch {}

      // Ask server for a start token (your existing route)
      const r = await fetch("/api/start-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ plan, wid }),
      });

      let j: any = null;
      try { j = await r.json(); } catch { throw new Error(`Bad JSON (HTTP ${r.status})`); }
      if (!r.ok || !j?.startParam) throw new Error(j?.msg || `HTTP ${r.status}`);

      if (j?.wid) { try { localStorage.setItem("brainbot:wid", j.wid); } catch {} }

      // Encode subject+paper hint in the Telegram /start payload: sp_<sub>__p<no>__<st_...>
      const hint = `sp_${encodeURIComponent(subject)}__p${paper}__${j.startParam}`;
      const param = hint; // the bot can parse this to pre-select the paper flow
      setStartParam(param);

      const url = `https://t.me/${TG_BOT}?start=${encodeURIComponent(param)}`;
      try {
        window.open(url, "_blank", "noopener,noreferrer");
      } catch {
        linkRef.current?.click();
      }
    } catch (e: any) {
      setErr(e?.message || "Couldn’t start the paper.");
    } finally {
      setLoading(false);
    }
  };

  const copyStart = async () => {
    if (!startParam) return;
    try {
      await navigator.clipboard.writeText(`/start ${startParam}`);
      alert("Copied! Paste in Telegram.");
    } catch {
      alert("Copy failed — type /start " + startParam);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 text-white">
      <section className="min-h-screen flex items-center px-4 py-10">
        <div className="glass mx-auto w-[96vw] max-w-3xl rounded-2xl p-8 md:p-12 shadow-glass">
          <div className="mb-4 text-center">
            <KCSEBadge />
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-gold-500 text-center">
            Start a Full KCSE Paper
          </h1>
          <p className="text-steel-300 mt-2 text-center">
            Choose your subject and paper number. We’ll launch Telegram and track your session.
            Plan: <b className="text-gold-400">{plan === "free" ? "Free" : plan}</b>.
          </p>

          {err && (
            <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-rose-200 text-sm">
              {err}
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-steel-300 mb-1">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">Select subject…</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-steel-300 mb-1">Paper</label>
              <select
                value={paper}
                onChange={(e) => setPaper(e.target.value as "1" | "2" | "3" | "")}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">Select paper…</option>
                <option value="1">Paper 1</option>
                <option value="2">Paper 2</option>
                <option value="3">Paper 3</option>
              </select>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={buildAndOpen}
              disabled={!canStart}
              className="rounded-2xl px-8 py-4 text-lg font-bold bg-gold-500 text-ink-900 hover:bg-gold-400 disabled:opacity-60"
            >
              {loading ? "Preparing…" : "Open in Telegram"}
            </button>

            <button
              onClick={copyStart}
              disabled={!startParam}
              className="rounded-2xl px-4 py-3 text-sm font-semibold border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-60"
            >
              Copy “/start …”
            </button>
          </div>

          {/* Hidden anchor fallback (tg:// deep link) */}
          {startParam && (
            <a
              ref={linkRef}
              href={`tg://resolve?domain=${TG_BOT}&start=${encodeURIComponent(startParam)}`}
              className="hidden"
            >
              Telegram Fallback
            </a>
          )}

          <div className="mt-6 text-center text-sm text-steel-300">
            Prefer pairing by code?{" "}
            <Link href="/link" className="underline text-mint-400">
              Use 6-digit code
            </Link>.
          </div>
        </div>
      </section>
    </main>
  );
}
