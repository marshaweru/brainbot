// apps/web/components/ExpiryCountdown.tsx
"use client";
import { useEffect, useState } from "react";

function fmt(n: number) {
  return String(n).padStart(2, "0");
}

export default function ExpiryCountdown({ target }: { target: Date | string }) {
  // Normalize input → timestamp
  const targetMs =
    typeof target === "string" ? new Date(target).getTime() : target.getTime();

  const [remaining, setRemaining] = useState(targetMs - Date.now());

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, targetMs - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (remaining <= 0) {
    return <span className="text-sm text-rose-400 font-medium">Expired</span>;
  }

  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining / 60000) % 60);
  const s = Math.floor((remaining / 1000) % 60);

  return (
    <span className="text-sm text-steel-300">
      Expires in{" "}
      <b className="text-gold-400">
        {h > 0 && `${h}h `}{fmt(m)}m {fmt(s)}s
      </b>
    </span>
  );
}
