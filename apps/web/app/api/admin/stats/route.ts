// apps/web/app/api/admin/stats/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function toInt(v: unknown, f: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : f;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const isDev = process.env.NODE_ENV !== "production";

  // TODO: replace these with real DB queries
  const envSubs = toInt(process.env.ADMIN_SUBSCRIBERS, 0);
  const envPays = toInt(process.env.ADMIN_PAYMENTS_TODAY, 0);
  const envActive = toInt(process.env.ADMIN_ACTIVE_SESSIONS, 0);
  const envRev = toInt(process.env.ADMIN_REVENUE_TODAY_KES, 0);

  const subscribers = isDev ? toInt(url.searchParams.get("subs"), envSubs) : envSubs;
  const paymentsToday = isDev ? toInt(url.searchParams.get("pays"), envPays) : envPays;
  const activeSessions = isDev ? toInt(url.searchParams.get("active"), envActive) : envActive;
  const revenueTodayKES = isDev ? toInt(url.searchParams.get("rev"), envRev) : envRev;

  const res = NextResponse.json({ subscribers, paymentsToday, activeSessions, revenueTodayKES });
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}
