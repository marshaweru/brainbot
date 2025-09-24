import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureWebIndexes } from "@/lib/indexes";
import { ensureAnalyticsIndexes } from "@/lib/analytics/indexes";

function authorized(req: Request) {
  const hdr = req.headers.get("x-admin-token");
  const token = process.env.ADMIN_TASKS_TOKEN;
  return Boolean(token && hdr === token);
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const database = await db();
    const web = await ensureWebIndexes(database);
    const analytics = await ensureAnalyticsIndexes(database);
    return NextResponse.json({ ok: true, web, analytics }, { status: 200 });
  } catch (e: any) {
    console.error("ensure-indexes error:", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
