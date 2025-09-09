"use client";
import { useEffect, useState } from "react";

function fmt(n: number) { return String(n).padStart(2, "0"); }

export default function ExpiryCountdown({ targetMs }: { targetMs: number }) {
  const [txt, setTxt] = useState("…");

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, targetMs - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff / 60000) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setTxt(diff === 0 ? "expired" : `in ${h}h ${fmt(m)}m ${fmt(s)}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  return <span className="text-sm text-steel-300">Expires: {txt}</span>;
}
