// apps/web/components/AdminStatsGrid.tsx
import StatCard from "@/components/StatCard";
import { headers } from "next/headers";

type AdminStats = {
  subscribers: number;
  paymentsToday: number;
  activeSessions: number;
  revenueTodayKES: number;
};

function moneyKES(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

export default async function AdminStatsGrid() {
  // Build absolute URL that works locally + on Render
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = `${proto}://${host}`;

  let stats: AdminStats = { subscribers: 0, paymentsToday: 0, activeSessions: 0, revenueTodayKES: 0 };

  try {
    const res = await fetch(`${base}/api/admin/stats`, { cache: "no-store" });
    if (res.ok) stats = await res.json();
  } catch {
    // keep defaults
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard title="Subscribers" value={stats.subscribers} valueClass="text-mint-400" />
      <StatCard title="Payments Today" value={stats.paymentsToday} valueClass="text-green-400" />
      <StatCard title="Active Sessions" value={stats.activeSessions} valueClass="text-sky-400" />
      <StatCard title="Revenue Today" value={moneyKES(stats.revenueTodayKES)} valueClass="text-yellow-400" />
    </div>
  );
}
