// apps/web/app/free-session/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import KCSEBadge from "@/components/KCSEBadge";

const TG_BOT = "brainbotafrica_bot";

export default function FreeSessionPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 text-white">
      <section className="min-h-screen flex items-center px-4 py-10">
        <StartBlock />
      </section>
    </main>
  );
}

function StartBlock() {
  const plan = useMemo(() => "free", []);
  const [startParam, setStartParam] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ensure a stable wid for this browser
    let wid = "";
    try {
      wid = localStorage.getItem("brainbot:wid") || "";
      if (!wid) {
        // window.crypto is available in the browser runtime
        wid = crypto.randomUUID();
        localStorage.setItem("brainbot:wid", wid);
      }
    } catch {
      // If storage is blocked, continue without caching wid
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch("/api/start-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ plan, wid }),
        });

        let j: any = null;
        try {
          j = await r.json();
        } catch {
          throw new Error(`Bad JSON (HTTP ${r.status})`);
        }
        if (!r.ok) {
          throw new Error(j?.msg || `HTTP ${r.status}`);
        }

        if (j?.wid) {
          try { localStorage.setItem("brainbot:wid", j.wid); } catch {}
        }
        const st = j?.startParam || (j?.token ? `st_${j.token}` : "");
        setStartParam(st);
      } catch (e: any) {
        setError(e?.message || "Couldn’t prepare the session. Try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [plan]);

  const deepLink = startParam
    ? `https://t.me/${TG_BOT}?start=${encodeURIComponent(startParam)}`
    : "";

  const openTelegram = () => {
    if (!deepLink) return;
    window.open(deepLink, "_blank", "noopener,noreferrer");
  };

  const copyCommand = async () => {
    if (!startParam) return;
    try {
      await navigator.clipboard.writeText(`/start ${startParam}`);
      alert("Copied! Paste in Telegram.");
    } catch {
      alert("Copy failed—just type /start " + startParam);
    }
  };

  return (
    <div className="glass mx-auto w-[96vw] max-w-5xl rounded-2xl p-10 md:p-14 shadow-glass text-center">
      <div className="mb-4"><KCSEBadge /></div>

      <h2 className="text-3xl md:text-4xl font-extrabold text-gold-500 mb-2">
        Start Your Free 3-Hour KCSE Session
      </h2>
      <p className="text-steel-300">Runs in Telegram with fast uploads and examiner feedback.</p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={openTelegram}
          disabled={!startParam || loading}
          className="rounded-2xl px-8 py-4 text-lg font-bold bg-gold-500 text-ink-900 hover:bg-gold-400 disabled:opacity-60"
        >
          {loading ? "Preparing…" : "Open in Telegram"}
        </button>

        <button
          onClick={copyCommand}
          disabled={!startParam}
          className="rounded-2xl px-4 py-3 text-sm font-semibold border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-60"
        >
          Copy “/start …”
        </button>
      </div>

      {error && <div className="mt-4 text-rose-300 text-sm">{error}</div>}

      <div className="mt-6 text-sm text-steel-300">
        Prefer pairing by code?{" "}
        <Link href="/link" className="underline text-mint-400">
          Use 6-digit code
        </Link>.
      </div>
    </div>
  );
}
