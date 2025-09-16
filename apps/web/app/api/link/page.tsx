"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function LinkAccountPage() {
  const [code, setCode] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [claimed, setClaimed] = useState(false);
  const [expired, setExpired] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/link/start", { method: "POST" });
      const j = await res.json();
      setCode(j.code);
      setExpiresAt(j.expiresAt);
    })();
  }, []);

  useEffect(() => {
    if (!code) return;
    const poll = async () => {
      const r = await fetch(`/api/link/status?code=${code}`);
      const j = await r.json();
      if (!j.found) return;
      if (j.expired) {
        setExpired(true);
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }
      if (j.claimed && j.wid) {
        localStorage.setItem("brainbot:wid", String(j.wid)); // wid-first
        setClaimed(true);
        if (pollRef.current) clearInterval(pollRef.current);
        setTimeout(() => (window.location.href = "/dashboard"), 1000);
      }
    };
    pollRef.current = window.setInterval(poll, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [code]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 text-white flex items-center px-4">
      <div className="glass mx-auto w-[90vw] max-w-xl rounded-2xl shadow-glass p-8 text-center">
        <h1 className="text-3xl font-extrabold text-gold-500">Link Your Account</h1>
        <p className="text-steel-300 mt-2">
          Open Telegram and send the code below to <b>@brainbotafrica_bot</b> using{" "}
          <code>/link &lt;code&gt;</code>.
        </p>

        <div className="mt-6 rounded-2xl bg-white/[0.06] border border-white/10 inline-block px-8 py-6">
          <div className="text-sm text-steel-300 mb-1">Your code (expires in 10 min)</div>
          <div className="text-5xl font-black tracking-widest">{code || "••••••"}</div>
        </div>

        <div className="mt-6">
          {!expired && !claimed && (
            <div className="text-xs text-steel-300">Waiting for claim in Telegram…</div>
          )}
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
