export const dynamic = 'force-dynamic';
// apps/web/app/receipt/[id]/page.tsx
import type { Metadata } from "next";
import { headers } from "next/headers";

type Receipt = {
  amount: number;
  tier: string;
  days: number;
  receipt?: string | null;     // M-PESA receipt number
  checkoutId?: string | null;  // your internal checkout id
  txAt?: string | null;        // ISO date string when paid
  createdAt: string;           // ISO date string when created
};

export const metadata: Metadata = {
  title: "Receipt • BrainBot Africa",
};

function safeInt(n: unknown, fallback: number) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

async function getBaseURL() {
  const h = headers();
  const forwardedHost = h.get("x-forwarded-host");
  const host = forwardedHost ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function fetchReceipt(id: string): Promise<Receipt | null> {
  const base = await getBaseURL();
  const res = await fetch(`${base}/api/receipt/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!res.ok) return null;
  const j = await res.json();
  return j?.receipt ?? null;
}

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const data = await fetchReceipt(params.id);

  if (!data) {
    return (
      <main className="min-h-svh bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <h1 className="text-xl font-extrabold mb-2">Receipt not found</h1>
          <p className="text-white/70 mb-4">
            We couldn’t find a receipt for ID: <span className="font-mono">{params.id}</span>
          </p>
          <a href="/dashboard" className="inline-block rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/10">
            Back to dashboard
          </a>
        </div>
      </main>
    );
  }

  const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "KES", maximumFractionDigits: 0 });
  const dt = new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });

  const paidWhen = data.txAt || data.createdAt;
  const paidDate = paidWhen ? new Date(paidWhen) : null;
  const prettyWhen = paidDate && !Number.isNaN(paidDate.getTime()) ? dt.format(paidDate) : paidWhen;

  const ref = data.receipt || data.checkoutId || params.id;

  return (
    <html lang="en">
      <head />
      <body className="bg-black text-white">
        {/* Print styles */}
        <style>{`
          @media print {
            .print-hide { display: none !important; }
            body { background: #fff !important; color: #000 !important; }
            .sheet { box-shadow: none !important; border: none !important; }
          }
        `}</style>

        <main className="min-h-svh flex flex-col items-center px-6 py-8">
          {/* Toolbar */}
          <div className="print-hide w-full max-w-3xl mb-4 flex items-center justify-between">
            <a href="/dashboard" className="rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:bg-white/10">← Back</a>
            <button
              onClick={() => window.print()}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:bg-white/10"
              type="button"
            >
              Print
            </button>
          </div>

          {/* Sheet */}
          <section className="sheet w-full max-w-3xl rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-xl font-extrabold">Payment Receipt</h1>
                <p className="text-sm opacity-70">© {new Date().getFullYear()} BrainBot Africa — KCSE Focused Exam Trainer</p>
              </div>
              <div className="text-right">
                <div className="text-sm opacity-70">Ref</div>
                <div className="font-mono text-sm">{ref}</div>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="text-xs opacity-70">Plan</div>
                <div className="text-lg font-semibold">{data.tier}</div>
                <div className="text-xs opacity-70">{safeInt(data.days, 0)} days access</div>
              </div>

              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="text-xs opacity-70">Amount</div>
                <div className="text-lg font-semibold">{money.format(data.amount)}</div>
                <div className="text-xs opacity-70">{prettyWhen}</div>
              </div>
            </div>

            {/* Details */}
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <table className="w-full text-sm">
                <tbody className="[&_td]:py-2 [&_td]:align-top">
                  <tr>
                    <td className="opacity-70 w-40">Receipt Number</td>
                    <td className="font-mono">{data.receipt ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="opacity-70">Checkout ID</td>
                    <td className="font-mono">{data.checkoutId ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="opacity-70">Description</td>
                    <td>BrainBot subscription — {data.tier} ({safeInt(data.days, 0)} days)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer note */}
            <p className="mt-6 text-xs opacity-70">
              This is a system-generated receipt. For support, email <a className="underline" href="mailto:hello@brainbot.africa">hello@brainbot.africa</a>.
            </p>
          </section>
        </main>
      </body>
    </html>
  );
}
