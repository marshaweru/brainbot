'use client';

import { useEffect, useMemo, useState } from 'react';

type Tone = 'red' | 'emerald' | 'sky' | 'yellow';

function cls(tone: Tone) {
  const map: Record<Tone, { bg: string; border: string; text: string }> = {
    red: { bg: 'bg-red-500/15', border: 'border-red-400/30', text: 'text-red-300' },
    emerald: { bg: 'bg-emerald-500/15', border: 'border-emerald-400/30', text: 'text-emerald-300' },
    sky: { bg: 'bg-sky-500/15', border: 'border-sky-400/30', text: 'text-sky-300' },
    yellow: { bg: 'bg-yellow-500/15', border: 'border-yellow-400/30', text: 'text-yellow-300' },
  };
  return map[tone];
}

export default function CountdownBadge(props: {
  /** Target date/time. ISO string with TZ (recommended) or a Date object. */
  target?: string | Date;
  /** Label shown before the countdown (e.g., "KCSE 2025"). */
  label?: string;
  /** When fewer than this many days remain, switch to hours. */
  showHoursUnderDays?: number;
  /** Refresh interval in ms (defaults to 60s). */
  refreshMs?: number;
  /** Accent color */
  tone?: Tone;
  /** Extra classes for the wrapper badge */
  className?: string;
}) {
  const {
    target = '2025-11-03T08:00:00+03:00',
    label = 'KCSE 2025',
    showHoursUnderDays = 2,
    refreshMs = 60_000,
    tone = 'red',
    className = '',
  } = props;

  const targetDate = useMemo(
    () => (typeof target === 'string' ? new Date(target) : target),
    [target]
  );

  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);

  // Invalid target safety
  if (Number.isNaN(targetDate.getTime())) {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-gray-300 text-sm font-medium mb-3 ${className}`}
      >
        ⏳ {label}: —
      </div>
    );
  }

  const msLeft = Math.max(0, (targetDate.getTime() - (now?.getTime() ?? Date.now())));
  const dayMs = 86_400_000;
  const hourMs = 3_600_000;

  const daysLeft = Math.ceil(msLeft / dayMs);
  const hoursLeft = Math.ceil(msLeft / hourMs);

  const showHours = daysLeft > 0 && daysLeft < showHoursUnderDays;
  const { bg, border, text } = cls(tone);

  return (
    <div
      aria-live="polite"
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${bg} ${border} ${text} border text-sm font-medium mb-3 ${className}`}
      title={targetDate.toString()}
    >
      ⏳ {label}:{' '}
      {now
        ? showHours
          ? `${hoursLeft} hour${hoursLeft === 1 ? '' : 's'} left`
          : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
        : '…'}
    </div>
  );
}
