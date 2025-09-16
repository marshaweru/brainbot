"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import KCSEBadge from "@/components/KCSEBadge";
import Link from "next/link";

export default function SessionPage() {
  const plan = useMemo(
    () =>
      (
        new URLSearchParams(
          typeof window !== "undefined" ? window.location.search : ""
        ).get("plan") || "free"
      ).toLowerCase(),
    []
  );

  const [start, setStart] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // Ensure a persistent wid for this browser
    let wid = localStorage.getItem("brainbot:wid");
    if (!wid) {
      wid = crypto.randomUUID();
      localStorage.setItem("brainbot:wid", wid);
    }

    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/session/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, wid }),
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(
            `Start API failed (${res.status}): ${txt?.slice(0, 200)}`
          );
        }

        let j: any;
        try {
          j = await res.json();
        } catch {
          const txt = await res.text();
          throw new Error(
            `Bad JSON from /api/session/start: ${txt?.slice(0, 200)}`
          );
        }

        // Persist wid again in case server minted it
        if (j.wid) localStorage.setItem("brainbot:wid", j.wid);
        setStart(`st_${j.token ?? j.startParam?.slice(3)}`);
      } catch (err) {
        console.error("Session init failed:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [plan]);

  const handleOpen = () => {
    if (!start) return;
    const url = `https://t.me/brainbotafrica_bot?start=${encodeURIComponent(
      start
    )}`;
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // fallback
      if (linkRef.current) linkRef.current.click();
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 text-white">
      <section className="min-h-screen flex items-center px-4 py-10">
        <div className="glass mx-auto w-[96vw] max-w-3xl rounded-2xl p-8 md:p-12 shadow-glass text-center">
          <div className="mb-4">
            <KCSEBadge />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-gold-500">
            Open BrainBot in <span className="text-white">Telegram</span>
          </h1>
          <p className="text-steel-300 mt-3">
            We’ll run your session in Telegram with fast uploads and examiner
            feedback. Plan:{" "}
            <b className="text-gold-400">
              {plan === "free" ? "Free Trial" : plan}
            </b>
            .
          </p>

          <button
            onClick={handleOpen}
            disabled={!start || loading}
            className="mt-8 rounded-2xl px-8 py-4 text-lg font-bold bg-gold-500 text-ink-900 hover:bg-gold-400 disabled:opacity-60"
          >
            {loading ? "Preparing…" : "Open in Telegram"}
          </button>

          {/* Hidden anchor fallback */}
          {start && (
            <a
              ref={linkRef}
              href={`tg://resolve?domain=brainbotafrica_bot&start=${encodeURIComponent(
                start
              )}`}
              className="hidden"
            >
              Telegram Fallback
            </a>
          )}

          <div className="mt-6 text-sm text-steel-300">
            Nothing opens? Search <code>@brainbotafrica_bot</code> and send{" "}
            <code>/start</code>.
          </div>

          <div className="mt-6 text-xs text-steel-300">
            Prefer a code link?{" "}
            <Link className="underline text-mint-400" href="/link">
              Use 6-digit code
            </Link>
            .
          </div>
        </div>
      </section>
    </main>
  );
}
