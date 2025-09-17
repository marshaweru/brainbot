// apps/web/pages/receipt/[id].tsx
import type { GetServerSideProps } from "next";
import Head from "next/head";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getUserTelegramId } from "@/lib/telegram";

type Props = {
  ok: boolean;
  error?: string;
  receipt?: {
    amount: number;
    tier: string;
    days: number;
    receipt?: string | null;
    checkoutId?: string | null;
    txAt?: string | null;   // ISO
    createdAt: string;      // ISO
  };
};

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  try {
    const user = await getSessionUser(ctx.req as any, ctx.res as any);
    if (!user) return { props: { ok: false, error: "auth required" } };

    const id = String(ctx.params?.id || "");
    const telegramId = await getUserTelegramId(user.id);
    if (!telegramId) return { props: { ok: false, error: "link Telegram first" } };

    const conn = await db();
    const payments = conn.collection("payments");

    // Try match by receipt first, then by checkoutId
    const row =
      (await payments.findOne({ telegramId, receipt: id })) ||
      (await payments.findOne({ telegramId, checkoutId: id }));

    if (!row) return { props: { ok: false, error: "receipt not found" } };

    return {
      props: {
        ok: true,
        receipt: {
          amount: row.amount,
          tier: row.tier,
          days: row.days,
          receipt: row.receipt ?? null,
          checkoutId: row.checkoutId ?? null,
          txAt: row.txAt ? new Date(row.txAt).toISOString() : null,
          createdAt: row.createdAt
            ? new Date(row.createdAt).toISOString()
            : new Date().toISOString(),
        },
      },
    };
  } catch (e: any) {
    return { props: { ok: false, error: e?.message || "server error" } };
  }
};

export default function ReceiptPage({ ok, error, receipt }: Props) {
  if (!ok || !receipt) {
    return (
      <main className="p-6">
        <p className="text-red-600">{error || "Error"}</p>
      </main>
    );
  }

  const when = new Date(receipt.txAt || receipt.createdAt).toLocaleString();

  return (
    <>
      <Head>
        <title>Receipt • BrainBot</title>
      </Head>
      <main className="mx-auto max-w-xl p-6">
        <div className="rounded-2xl border p-6 shadow-sm">
          <h1 className="text-xl font-semibold mb-1">BrainBot Receipt</h1>
          <p className="text-sm opacity-80 mb-4">{when}</p>

          <dl className="space-y-2">
            <Row label="Plan">
              {receipt.tier} ({receipt.days} days)
            </Row>
            <Row label="Amount">KES {receipt.amount}</Row>
            <Row label="M-PESA Receipt">{receipt.receipt ?? "—"}</Row>
            <Row label="Checkout ID">{receipt.checkoutId ?? "—"}</Row>
          </dl>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => window.print()}
              className="rounded-xl border px-4 py-2 shadow-sm"
            >
              Print
            </button>
            <a
              href="/dashboard"
              className="rounded-xl border px-4 py-2 shadow-sm"
            >
              Back to dashboard
            </a>
          </div>
        </div>
      </main>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <dt className="opacity-70">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
