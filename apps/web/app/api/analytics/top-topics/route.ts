// apps/web/app/api/analytics/top-topics/route.ts
import { NextResponse } from "next/server";
import { getTopTopics7d } from "@/lib/analytics/drills";


// If you kept getTopTopics7d in drills.ts, import from "@/lib/analytics/drills" instead:
/// import { getTopTopics7d } from "@/lib/analytics/drills";

export async function GET() {
  try {
    const data = await getTopTopics7d();
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (e: any) {
    console.error("top-topics error:", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 200 });
  }
}
