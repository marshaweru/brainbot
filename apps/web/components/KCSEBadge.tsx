"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => String(n).padStart(2, "0");

export default function KCSEBadge() {
  const targetStr = process.env.NEXT_PUBLIC_KCSE_DATE || "2025-11-03T00:00:00+03:00";
  const target = new Date(targetStr).getTime();
  const [label, setLabel] = useState<string>("KCSE 2025: —");

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff / 3600000) % 24);
      const m = Math.floor((diff / 60000) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setLabel(`KCSE 2025: ${d}d ${fmt(h)}h ${fmt(m)}m ${fmt(s)}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold
                     bg-red-700/30 text-red-200 border border-red-500/40">
      {/* hourglass */}
      <svg width="14" height="14" viewBox="0 0 24 24" className="opacity-90">
        <path fill="#ffd54a" d="M6 2h12v2h-1a5 5 0 0 1-5 5a5 5 0 0 1-5-5H6V2m0 20h12v-2h-1a5 5 0 0 0-5-5a5 5 0 0 0-5 5H6v2Z"/>
        <path fill="#ffd54a" d="M7 4h10a4 4 0 0 1-4 4H11A4 4 0 0 1 7 4m0 16a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4H7Z"/>
      </svg>
      {label}
    </span>
  );
}
