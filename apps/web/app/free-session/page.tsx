import KCSEBadge from "../../components/KCSEBadge";
import Link from "next/link";

export default function FreeSessionPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 text-white">
      <section className="min-h-screen flex items-center px-4 py-10">
        <StartBlock />
      </section>
    </main>
  );
}

"use client";
import { useEffect, useMemo, useState } from "react";

function StartBlock() {
  const plan = useMemo(() => "free", []);
  const [startParam, setStartParam] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let wid = localStorage.getItem("brainbot:wid");
    if (!wid) { wid = crypto.randomUUID(); localStorage.setItem("brainbot:wid", wid); }
    (async () => {
      setLoading(true);
      const r = await fetch("/api/start-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, wid }),
      });
      const j = await r.json();
      if (j.wid) localStorage.setItem("brainbot:wid", j.wid);
      const st = j.startParam || `st_${j.token}`;
      setStartParam(st);
      setLoading(false);
    })();
  }, [plan]);

  const go = () => {
    if (!startParam) return;
    window.open(`https://t.me/brainbotafrica_bot?start=${encodeURIComponent(startParam)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="glass mx-auto w-[96vw] max-w-5xl rounded-2xl p-10 md:p-14 shadow-glass text-center">
      <div className="mb-4"><KCSEBadge /></div>
      <h2 className="text-3xl md:text-4xl font-extrabold text-gold-500 mb-2">Start Your Free 3-Hour KCSE Session</h2>
      <p className="text-steel-300">Runs in Telegram with fast uploads and examiner feedback.</p>
      <button onClick={go} disabled={!startParam || loading}
        className="mt-8 rounded-2xl px-8 py-4 text-lg font-bold bg-gold-500 text-ink-900 hover:bg-gold-400 disabled:opacity-60">
        {loading ? "Preparing…" : "Open in Telegram"}
      </button>
      <div className="mt-6 text-sm text-steel-300">
        Prefer pairing by code? <Link href="/link" className="underline text-mint-400">Use 6-digit code</Link>.
      </div>
    </div>
  );
}
