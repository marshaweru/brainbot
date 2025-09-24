// apps/web/components/Receipts.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Receipt = {
  amount: number;
  tier: string;
  days: number;
  receipt?: string | null;     // M-PESA receipt number
  checkoutId?: string | null;  // your internal checkout id
  txAt?: string | null;        // ISO date string when paid
  createdAt: string;           // ISO date string when created
};

type ApiResponse =
  | { receipts: Receipt[] }
  | { error: string };

// ---- tiny data client ------------------------------------------------------

async function fetchReceipts(signal?: AbortSignal): Promise<Receipt[]> {
  const r = await fetch("/api/receipts", {
    cache: "no-store",
    signal,
    headers: { Accept: "application/json" },
  });
  const j = (await r.json()) as ApiResponse;
  if (!r.ok) throw new Error(("error" in j && j.error) || "Failed to load receipts");
  return ("receipts" in j && Array.isArray(j.receipts)) ? j.receipts : [];
}

// ---- component -------------------------------------------------------------

export default function Receipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Track last known count to detect “new receipt”
  const lastCountRef = useRef<number>(0);

  // Polling config: start fast → back off if nothing new
  const baseIntervalMs = 10_000;           // 10s
  const maxIntervalMs = 60_000;            // 60s
  const intervalRef = useRef<number>(baseIntervalMs);

  const money = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "KES",
        maximumFractionDigits: 0,
      }),
    []
  );
  const dt = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  const load = useCallback(async () => {
    const ac = new AbortController();
    try {
      setLoading(true);
      setErr(null);
      const data = await fetchReceipts(ac.signal);
      setReceipts(data);
      setLastUpdated(Date.now());

      // If new receipts arrived, snap polling back to fast
      if (data.length > lastCountRef.current) {
        intervalRef.current = baseIntervalMs;
        lastCountRef.current = data.length;
      } else {
        // back off gently up to max
        intervalRef.current = Math.min(intervalRef.current * 1.5, maxIntervalMs);
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") setErr(e?.message || "Could not fetch receipts");
    } finally {
      setLoading(false);
    }
    return () => ac.abort();
  }, []);

  // initial load
  useEffect(() => {
    let cancel: (() => void) | undefined;
    load().then((c) => (cancel = c as any));
    return () => cancel?.();
  }, [load]);

  // revalidate on tab focus (user comes back from paying)
  useEffect(() => {
    const onFocus = () => {
      intervalRef.current = baseIntervalMs; // speed up
      load();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  // listen for "payment:done" broadcast (optional: fire this in your bot webview or post-pay redirect)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "payment:done") {
        intervalRef.current = baseIntervalMs;
        load();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [load]);

  // smart polling loop (only when page visible)
  useEffect(() => {
    let timer: number | undefined;
    const tick = () => {
      if (document.visibilityState === "visible") {
        load();
      }
      timer = window.setTimeout(tick, intervalRef.current);
    };
    timer = window.setTimeout(tick, intervalRef.current);
    return () => window.clearTimeout(timer);
  }, [load]);

  const onRefresh = useCallback(() => {
    intervalRef.current = baseIntervalMs; // manual refresh → fast again
    load();
  }, [load]);

  // ---- UI ------------------------------------------------------------------

  if (loading && receipts.length === 0) return <Card><p>Loading receipts…</p></Card>;
  if (err && receipts.length === 0) return <Card><p className="text-red-600">{err}</p></Card>;
  if (!receipts.length)
    return (
      <Card>
        <div className="flex items-center justify-between gap-3">
          <p>No payments yet. Once you upgrade, your receipts will appear here.</p>
          <RefreshBtn onClick={onRefresh} loading={loading} />
        </div>
      </Card>
    );

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold opacity-80">Your Receipts</h2>
        <div className="flex items-center gap-3 text-xs opacity-70">
          {lastUpdated ? <span>Updated {timeAgo(lastUpdated)}</span> : null}
          <RefreshBtn onClick={onRefresh} loading={loading} />
        </div>
      </div>

      {receipts.map((r, i) => {
        const when = parseWhen(r.txAt || r.createdAt);
        const humanWhen = when ? dt.format(when) : (r.txAt || r.createdAt);
        const idForLink = r.checkoutId || r.receipt || String(i);
        const hasLink = Boolean(r.checkoutId || r.receipt);

        return (
          <Card key={`${r.checkoutId ?? r.receipt ?? i}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-base font-semibold">
                  {r.tier} — {money.format(r.amount)} ({r.days} days)
                </h3>
                <p className="text-sm opacity-80">
                  {humanWhen} •{" "}
                  {r.receipt ? `Receipt: ${r.receipt}` : `Checkout: ${r.checkoutId ?? "—"}`}
                </p>
              </div>

              {hasLink ? (
                <a
                  className="text-sm underline whitespace-nowrap"
                  href={`/receipt/${encodeURIComponent(idForLink)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View receipt
                </a>
              ) : (
                <button
                  className="text-sm opacity-50 cursor-not-allowed whitespace-nowrap"
                  title="Receipt not available yet"
                  disabled
                >
                  View receipt
                </button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ---- helpers ----------------------------------------------------------------

function parseWhen(s?: string | null) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function timeAgo(ts: number) {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm">
      {children}
    </div>
  );
}

function RefreshBtn({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-60"
      title="Refresh receipts"
      type="button"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
        <path d="M21 12a9 9 0 1 1-2.64-6.36" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M21 4v6h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
      {loading ? "Refreshing…" : "Refresh"}
    </button>
  );
}
