// apps/web/components/Receipts.tsx
"use client";
import { useEffect, useState } from "react";

type Receipt = {
  amount: number;
  tier: string;
  days: number;
  receipt?: string | null;
  checkoutId?: string | null;
  txAt?: string | null;      // ISO string
  createdAt: string;         // ISO string
};

export default function Receipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/receipts", { cache: "no-store" });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Failed to load receipts");
        setReceipts(j.receipts || []);
      } catch (e: any) {
        setErr(e?.message || "Could not fetch receipts");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Card><p>Loading receipts…</p></Card>;
  if (err) return <Card><p className="text-red-600">{err}</p></Card>;
  if (!receipts.length) return <Card><p>No payments yet. Once you upgrade, your receipts will appear here.</p></Card>;

  return (
    <div className="grid gap-4">
      {receipts.map((r, i) => (
        <Card key={i}>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-base font-semibold">
                {r.tier} — KES {r.amount} ({r.days} days)
              </h3>
              <p className="text-sm opacity-80">
                {formatWhen(r)} • {r.receipt ? `Receipt: ${r.receipt}` : `Checkout: ${r.checkoutId ?? "—"}`}
              </p>
            </div>
            {/* “View receipt” link: opens a minimal printable view */}
            <a
              className="text-sm underline"
              href={`/receipt/${encodeURIComponent(r.checkoutId || r.receipt || String(i))}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View receipt
            </a>
          </div>
        </Card>
      ))}
    </div>
  );
}

function formatWhen(r: Receipt) {
  const when = r.txAt || r.createdAt;
  try {
    const d = new Date(when);
    return d.toLocaleString();
  } catch {
    return when;
  }
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-4 shadow-sm">
      {children}
    </div>
  );
}
