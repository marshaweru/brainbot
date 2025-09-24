// apps/web/app/link/page.tsx
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
  const [expiresAt, setExpiresAt] = useState("");
  const [timeLeft, setTimeLeft] = useState("");
  const [claimed, setClaimed] = useState(false);
  const [expired, setExpired] = useState(false);

  const pollRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const clearTimers = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    abortRef.current?.abort();
  }, []);

  // Kick off a new link code
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/link/start", { method: "POST", cache: "no-store" });
      const j: StartResp = await res.json();
      setCode(j.code);
      setExpiresAt(j.expiresAt);
    })().catch(() => {});
    return clearTimers;
  }, [clearTimers]);

  // Countdown UI
  useEffect(() => {
    if (!expiresAt) return;
    const end = Date.parse(expiresAt);
    const tick = () => {
      const ms = Math.max(0, end - Date.now());
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setTimeLeft(`${m}:${String(s).padStart(2, "0")}`);
      if (ms <= 0) { setExpired(true); clearTimers(); }
    };
    tick();
    tickRef.current = window.setInterval(tick, 1000);
    return clearTimers;
  }, [expiresAt, clearTimers]);

  // Poll claim status
  useEffect(() => {
    if (!code || expired) return;
    const poll = async () => {
      try {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const r = await fetch(`/api/link/status?code=${encodeURIComponent(code)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const j: StatusResp = await r.json();

        if (!j.found) return;
        if (j.expired) { setExpired(true); clearTimers(); return; }

        if (j.claimed) {
          // Prefer wid for the dashboard; keep claimedBy as a fallback
          if (j.wid) localStorage.setItem("brainbot:wid", String(j.wid));
          if (j.claimedBy) localStorage.setItem("brainbot:tid", String(j.claimedBy));
          setClaimed(true);
          clearTimers();
          setTimeout(() => { window.location.href = "/dashboard"; }, 800);
        }
      } catch {
        /* ignore transient failures */
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
          In Telegram, send this code to <b>@brainbotafrica_bot</b> via{" "}
          <code>/link &lt;code&gt;</code> or{" "}
          <a className="underline" href={tgDeepLink} target="_blank" rel="noreferrer">open directly</a>.
        </p>

        <button
          onClick={copy}
          className="mt-6 rounded-2xl bg-white/[0.06] border border-white/10 inline-block px-8 py-6 hover:bg-white/[0.1]"
        >
          <div className="text-sm text-steel-300 mb-1">
            Your code {timeLeft ? `(expires in ${timeLeft})` : "(expires in 10 min)"}
          </div>
          <div className="text-5xl font-black tracking-widest">{code || "••••••"}</div>
          <div className="text-xs text-steel-300 mt-2">(Click to copy)</div>
        </button>

        <div className="mt-6">
          {!expired && !claimed && <div className="text-xs text-steel-300">Waiting for claim in Telegram…</div>}
          {expired && <div className="text-rose-400 text-sm">Code expired. Refresh to get a new one.</div>}
          {claimed && <div className="text-emerald-400 text-sm">Linked! Redirecting…</div>}
        </div>

        <div className="mt-8 text-xs text-steel-300">
          Or <Link className="underline" href="/session?plan=free">start a free session</Link> and we’ll link automatically later.
        </div>
      </div>
    </main>
  );
}
