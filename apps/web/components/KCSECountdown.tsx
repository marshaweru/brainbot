"use client";
import { useEffect, useState } from "react";

/**
 * KCSECountdown
 * Renders a live countdown to the KCSE start date.
 * Override with NEXT_PUBLIC_KCSE_DATE (ISO string), e.g. "2026-10-01T08:00:00+03:00"
 */
function getTarget(): number {
  const env = process.env.NEXT_PUBLIC_KCSE_DATE;
  const fallback = "2025-11-03T08:00:00+03:00"; // Nairobi time typical KCSE window
  const date = new Date(env && env.trim() !== "" ? env : fallback);
  return date.getTime();
}

export default function KCSECountdown() {
  const [now, setNow] = useState<number>(Date.now());
  const target = getTarget();
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const delta = Math.max(0, target - now);
  const s = Math.floor(delta / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  return (
    <div className="inline-flex items-center gap-3 rounded-2xl bg-white/10 dark:bg-black/20 px-4 py-2 backdrop-blur border border-white/20 shadow">
      <span className="text-sm opacity-80">KCSE Countdown</span>
      <span className="font-semibold tabular-nums text-lg">
        {days}d {hours}h {mins}m {secs}s
      </span>
    </div>
  );
}
