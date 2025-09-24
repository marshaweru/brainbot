'use client';
export const dynamic = 'force-dynamic';

// apps/web/app/session/page.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import KCSEBadge from "@/components/KCSEBadge";
import Link from "next/link";
import NextDynamic from "next/dynamic"; // ⬅️ alias to avoid name clash

// client-only guard (avoids SSR touching localStorage)
const TimedSessionGuard = NextDynamic(() => import("@/components/TimedSessionGuard"), { ssr: false });

const TG_BOT = "brainbotafrica_bot";
const PLAN_KEYS = ["free", "lite", "steady", "serious", "elite", "limited"] as const;
type PlanKey = (typeof PLAN_KEYS)[number];

function toPlanKey(v: unknown): PlanKey {
  const s = String(v ?? "free").toLowerCase();
  return (PLAN_KEYS as readonly string[]).includes(s) ? (s as PlanKey) : "free";
}
function toInt(v: unknown, fb: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fb;
}

export default function SessionPage() {
  const { plan, durMins } = useMemo(() => {
    if (typeof window === "undefined") return { plan: "free" as PlanKey, durMins: 0 };
    const qp = new URLSearchParams(window.location.search);
    const planKey = toPlanKey(qp.get("plan"));
    const dur = toInt(qp.get("dur"), 0);
    return { plan: planKey, durMins: dur };
  }, []);

  const isFree = plan === "free";

  const computedHours = useMemo(() => {
    if (!isFree) return 0;
    if (durMins > 0) return Math.ceil((durMins + 60) / 30) * 0.5;
    return 3.5;
  }, [isFree, durMins]);

  const [start, setStart] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let wid = "";
    try {
      if (typeof window !== "undefined" && "localStorage" in window) {
        wid = window.localStorage.getItem("brainbot:wid") || "";
        if (!wid) {
          const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
          window.localStorage.setItem("brainbot:wid", id);
          wid = id;
        }
      }
    } catch {}

    (async () => {
      setLoading(true);
      setErr(null);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/start-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify({ plan, wid, durationMinutes: durMins > 0 ? durMins : undefined }),
        });

        const j = await res.json().catch(() => {
          throw new Error(`Bad JSON (HTTP ${res.status})`);
        });
        if (!res.ok || !j?.startParam) {
          throw new Error(j?.msg || `HTTP ${res.status}`);
        }

        if (j?.wid) {
          try {
            if (typeof window !== "undefined" && "localStorage" in window) {
              window.localStorage.setItem("brainbot:wid", String(j.wid));
            }
          } catch {}
        }
        setStart(String(j.startParam));
      } catch (e: any) {
        setErr(e?.message || "Couldn't prepare the session.");
      } finally {
        setLoading(false);
      }
    })();

    return () => abortRef.current?.abort();
  }, [plan, durMins]);

  const openTelegram = () => {
    if (!start) return;
    const url = `https://t.me/${TG_BOT}?start=${encodeURIComponent(start)}`;
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      linkRef.current?.click();
    }
  };

  const copyStart = async () => {
    if (!start) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(`/start ${start}`);
        alert("Copied! Paste in Telegram.");
      } else {
        throw new Error("No clipboard");
      }
    } catch {
      alert("Copy failed — type /start " + start);
    }
  };

  const Content = (
    <>
      <div className="mb-4">
        <KCSEBadge />
      </div>
      <h1 className="text-3xl md:text-4xl font-extrabold text-gold-500">
        Open BrainBot in <span className="text-white">Telegram</span>
      </h1>
      <p className="text-white/60 mt-3">
        We’ll run your session in Telegram with fast uploads and examiner feedback. Plan:{" "}
        <b className="text-gold-400">{isFree ? "Free Trial" : plan}</b>.
        {isFree && (
          <>
            {" "}
            {durMins > 0 ? (
              <span className="ml-1">
                Time cap: <b>{computedHours}h</b> (exam {Math.round(durMins / 30) * 30}m + 60m buffer)
              </span>
            ) : (
              <span className="ml-1">
                Time cap: <b>3.5h</b> (default if exam duration not specified — add <code>?dur=120</code> or <code>150</code> to match your paper)
              </span>
            )}
          </>
        )}
      </p>

      {err && (
        <div className="mt-4 text-rose-300 text-sm">
          {err}{" "}
          <button onClick={openTelegram} className="underline ml-1">
            Retry
          </button>
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-3">
        <button
          onClick={openTelegram}
          disabled={!start || loading}
          className="rounded-2xl px-8 py-4 text-lg font-bold bg-gold-500 text-ink-900 hover:bg-gold-400 disabled:opacity-60"
        >
          {loading ? "Preparing…" : "Open in Telegram"}
        </button>

        <button
          onClick={copyStart}
          disabled={!start}
          className="rounded-2xl px-4 py-3 text-sm font-semibold border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-60"
        >
          Copy “/start …”
        </button>
      </div>

      {start && (
        <a
          ref={linkRef}
          href={`tg://resolve?domain=${TG_BOT}&start=${encodeURIComponent(start)}`}
          className="hidden"
        >
          Telegram Fallback
        </a>
      )}

      <div className="mt-6 text-sm text-white/60">
        Nothing opens? Search <code>@{TG_BOT}</code> and send <code>/start</code>.
      </div>

      <div className="mt-6 text-xs text-white/60">
        Prefer a code link?{" "}
        <Link className="underline text-mint-400" href="/link">
          Use 6-digit code
        </Link>
        .
      </div>
    </>
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 text-white">
      <section className="min-h-screen flex items-center px-4 py-10">
        <div className="glass mx-auto w-[96vw] max-w-3xl rounded-2xl p-8 md:p-12 shadow-glass text-center">
          {isFree ? (
            <TimedSessionGuard
              maxHours={computedHours}
              storageKey={`brainbot_session_start_${plan}_${durMins || "default"}`}
            >
              {Content}
            </TimedSessionGuard>
          ) : (
            Content
          )}
        </div>
      </section>
    </main>
  );
}
