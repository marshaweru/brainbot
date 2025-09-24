// apps/web/app/api/limited-edition/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // consistent with other API routes

function toInt(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  // Env-configurable totals
  const envClaimed = toInt(process.env.LIMITED_EDITION_CLAIMED, 0);
  const envTotal = toInt(process.env.LIMITED_EDITION_TOTAL, 100);

  // In dev, allow quick preview via ?claimed=NUM (ignored in production)
  const isDev = process.env.NODE_ENV !== "production";
  const previewClaimed = isDev ? toInt(url.searchParams.get("claimed"), envClaimed) : envClaimed;

  // Sanity checks + clamping
  const total = Math.max(1, envTotal);
  const claimed = Math.min(Math.max(0, previewClaimed), total);

  const res = NextResponse.json({ claimed, total });
  // Always fresh for SSR
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}
