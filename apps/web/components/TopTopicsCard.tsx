// apps/web/components/TopTopicsCard.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Topic = { topic: string; count: number; users: number };
type Payload = { ok: boolean; data?: Topic[]; error?: string };

const TG_BOT = "brainbotafrica_bot";

export default function TopTopicsCard() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/analytics/top-topics", { cache: "no-store" });
        const j = (await r.json()) as Payload;
        if (alive) setPayload(j);
      } catch (e) {
        if (alive) setPayload({ ok: false, error: String(e) });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-semibold text-white/90 mb-3">Top Topics (7 days)</h3>

      {loading && <p className="text-xs text-white/50">Loading…</p>}
      {!loading && !payload?.ok && <p className="text-xs text-rose-300">Failed: {payload?.error}</p>}

      {!loading && payload?.ok && (
        <ul className="space-y-2">
          {(payload.data ?? []).map((t) => (
            <li key={t.topic} className="flex items-center justify-between text-sm">
              <span className="truncate">{t.topic}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50">{t.count} drills</span>
                <button
                  onClick={() => router.push(`/drill?topic=${encodeURIComponent(t.topic)}`)}
                  className="text-xs px-2 py-1 rounded bg-mint-500 text-ink-900 hover:bg-mint-400"
                >
                  Web
                </button>
                <a
                  href={`https://t.me/${TG_BOT}?start=${encodeURIComponent(`drill_${t.topic}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 rounded bg-plum-400 text-ink-900 hover:bg-plum-500"
                >
                  TG
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && payload?.ok && (payload.data ?? []).length === 0 && (
        <p className="text-xs text-white/50">No drills yet this week.</p>
      )}
    </div>
  );
}
