// apps/web/app/api/link/page.tsx
"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

type StartResp = { ok?: boolean; code: string; expiresAt: string };
type StatusResp = {
  ok: boolean;
  found: boolean;
  expired: boolean;
  claimed: boolean;
  claimedBy: number | null;
  wid?: string | null;
};

export default function LinkAccountPage() {
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState("");
  const [claimed, setClaimed] = useState(false);
  const [expired, setExpired] = useState(false);

  const pollRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // Start a linking code
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/link/start", { method: "POST" });
      const j: StartResp = await res.json();
      setCode(j.code);
      setExpiresAt(j.expiresAt);
    })().catch(() => {});
    return clearTimers;
  }, [clearTimers]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;
    const end = Date.parse(expiresAt);

    const tick = () => {
      const ms = Math.max(0, end - Date.now());
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setTimeLeft(`${m}:${String(s).padStart(2, "0")}`);
      if (ms <= 0) {
        setExpired(true);
        clearTimers();
      }
    };

    tick();
    timerRef.current = window.setInterval(tick, 1000);
    return clearTimers;
  }, [expiresAt, clearTimers]);

  // Poll for claim status
  useEffect(() => {
    if (!code || expired) return;

    const poll = async () => {
      try {
        const r = await fetch(`/api/link/status?code=${encodeURIComponent(code)}`, { cache: "no-store" });
        const j: StatusResp = await r.json();
        if (!j.found) return;
        if (j.expired) { setExpired(true); clearTimers(); return; }
        if (j.claimed && j.wid) {
          localStorage.setItem("brainbot:wid", String(j.wid));
          setClaimed(true);
          clearTimers();
          setTimeout(() => { window.location.href = "/dashboard"; }, 800);
        }
      } catch {
        /* ignore transient errors */
      }
    };

    pollRef.current = window.setInterval(poll, 2000);
    return clearTimers;
  }, [code, expired, clearTimers]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(code); } catch {}
  };

  const tgDeepLink = `https://t.me/brainbotafrica_bot?start=${encodeURIComponent("link_" + code)}`;

  return (
    <main className="min-h-screen bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 text-white flex items-center px-4">
      <div className="glass mx-auto w-[90vw] max-w-xl rounded-2xl shadow-glass p-8 text-center">
        <h1 className="text-3xl font-extrabold text-gold-500">Link Your Account</h1>
        <p className="text-steel-300 mt-2">
          Send this code to <b>@brainbotafrica_bot</b> via <code>/link &lt;code&gt;</code> or{" "}
          <a className="underline" href={tgDeepLink} target="_blank" rel="noreferrer">open directly in Telegram</a>.
        </p>

        <button onClick={copy} className="mt-6 rounded-2xl bg-white/[0.06] border border-white/10 inline-block px-8 py-6 hover:bg-white/[0.1]">
          <div className="text-sm text-steel-300 mb-1">
            Your code {timeLeft ? `(expires in ${timeLeft})` : ""}
          </div>
          <div className="text-5xl font-black tracking-widest">{code || "••••••"}</div>
          <div className="text-xs text-steel-300 mt-2">(Click to copy)</div>
        </button>

        <div className="mt-6">
          {!expired && !claimed && (
            <div className="text-xs text-steel-300">Waiting for claim in Telegram…</div>
          )}
          {expired && <div className="text-rose-400 text-sm">Code expired. Refresh to get a new one.</div>}
          {claimed && <div className="text-emerald-400 text-sm">Linked! Redirecting…</div>}
        </div>

        <div className="mt-8 text-xs text-steel-300">
          Or{" "}
          <Link className="underline" href="/session?plan=free">
            start a free session
          </Link>{" "}
          and we’ll link automatically later.
        </div>
      </div>
    </main>
  );
}
