"use client";
import { useEffect, useMemo, useState } from "react";

type Props = {
  children: React.ReactNode;
  maxHours?: number; // default 3 hours
  storageKey?: string; // default "brainbot_free_session_start"
};

export default function TimedSessionGuard({ children, maxHours = 3, storageKey = "brainbot_free_session_start" }: Props) {
  const [now, setNow] = useState<number>(Date.now());
  const msLimit = (maxHours || 3) * 60 * 60 * 1000;

  useEffect(() => {
    const existing = localStorage.getItem(storageKey);
    if (!existing) {
      localStorage.setItem(storageKey, String(Date.now()));
    }
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [storageKey]);

  const start = useMemo(() => {
    const s = Number(localStorage.getItem(storageKey) || Date.now());
    return isNaN(s) ? Date.now() : s;
  }, [storageKey, now]);

  const elapsed = Math.max(0, now - start);
  const remaining = Math.max(0, msLimit - elapsed);
  const expired = remaining <= 0;

  const s = Math.floor(remaining / 1000);
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between rounded-xl border px-4 py-2 text-sm">
        <span>Free session limit: {maxHours} hours</span>
        <span className="font-semibold tabular-nums">Time left: {hours}h {mins}m {secs}s</span>
      </div>
      {expired ? (
        <div className="rounded-xl border border-red-300/40 bg-red-500/10 p-4">
          <div className="font-semibold">Free session ended</div>
          <div className="text-sm opacity-80">Upgrade to continue with full access.</div>
        </div>
      ) : (
        <>{children}</>
      )}
    </div>
  );
}
