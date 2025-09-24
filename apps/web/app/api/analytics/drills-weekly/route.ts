// apps/web/app/api/analytics/drills-weekly/route.ts
import { NextResponse } from "next/server";
import { getDrillsThisWeek } from "@/lib/analytics/drills";

export async function GET() {
  try {
    const data = await getDrillsThisWeek();
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (e: any) {
    console.error("drills-weekly error:", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 200 });
  }
}
