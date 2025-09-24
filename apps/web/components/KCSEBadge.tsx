// apps/web/components/KCSEBadge.tsx
"use client";
import { useEffect, useMemo, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

type Props = {
  /** Exam date — ISO string or Date. Defaults to NEXT_PUBLIC_KCSE_DATE or 2025-11-03T00:00:00+03:00 */
  targetDate?: string | Date;
  /** Window start for progress ring — ISO or Date. Defaults to 1 year before target. */
  startDate?: string | Date;
  /** Ring size in px (SVG viewbox), default 22 */
  size?: number;
  /** Show/Hide the ring (defaults true) */
  showRing?: boolean;
  /** Compact text (e.g., 12d 03:14:59) vs verbose (12d 03h 14m 59s). Default: verbose */
  compact?: boolean;
  /** Override the label prefix (e.g., “KCSE 2025”). Default: inferred from target year or “KCSE” */
  labelPrefix?: string;
  /** Optional className to tweak colors/sizing */
  className?: string;
};

export default function KCSEBadge({
  targetDate,
  startDate,
  size = 22,
  showRing = true,
  compact = false,
  labelPrefix,
  className = "",
}: Props) {
  const fallbackTarget = process.env.NEXT_PUBLIC_KCSE_DATE || "2025-11-03T00:00:00+03:00";

  const target = useMemo(() => {
    const d = targetDate instanceof Date ? targetDate : new Date(targetDate || fallbackTarget);
    return isNaN(d.getTime()) ? null : d;
  }, [targetDate, fallbackTarget]);

  const start = useMemo(() => {
    if (!target) return null;
    if (startDate) {
      const d = startDate instanceof Date ? startDate : new Date(startDate);
      return isNaN(d.getTime()) ? null : d;
    }
    // default window: 1 year before target
    const s = new Date(target);
    s.setFullYear(target.getFullYear() - 1);
    return s;
  }, [startDate, target]);

  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Derived timing
  const targetMs = target?.getTime() ?? NaN;
  const startMs = start?.getTime() ?? NaN;
  const nowMs = now.getTime();

  const invalid = !target || Number.isNaN(targetMs) || !start || Number.isNaN(startMs) || startMs >= targetMs;
  const remaining = invalid ? 0 : Math.max(0, targetMs - nowMs);
  const expired = !invalid && remaining === 0;

  // Format label
  let prefix = labelPrefix;
  if (!prefix) {
    const yr = target?.getFullYear();
    prefix = yr ? `KCSE ${yr}` : "KCSE";
  }

  const totalSec = Math.floor(remaining / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const body = invalid
    ? "date invalid"
    : expired
      ? "Done!"
      : compact
        ? `${days}d ${pad(hours)}:${pad(mins)}:${pad(secs)}`
        : `${days}d ${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`;

  // Progress ring (remaining arc shrinks to 0)
  const r = 9;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const pct = invalid ? 1 : Math.min(1, Math.max(0, (nowMs - startMs) / (targetMs - startMs)));
  const dash = circumference * (1 - pct);

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold
                  bg-red-700/30 text-red-200 border border-red-500/40 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={`${prefix}: ${body}`}
    >
      {showRing && (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="opacity-90">
          {/* Track */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.25"
            strokeWidth="2.5"
          />
          {/* Remaining arc */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeDasharray={circumference}
            strokeDashoffset={Math.max(0, Math.min(circumference, dash))}
            className={expired ? "opacity-40" : ""}
          />
        </svg>
      )}
      {prefix}: {body}
    </span>
  );
}
