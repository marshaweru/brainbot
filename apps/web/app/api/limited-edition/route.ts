import { NextResponse } from "next/server";

/**
 * Returns the number of Limited-Edition passes claimed.
 * In production, back this with your DB. For now we read env or default to 0.
 * 
 * Use env: LIMITED_EDITION_CLAIMED (number)
 */
export async function GET() {
  const raw = process.env.LIMITED_EDITION_CLAIMED || "0";
  const claimed = Math.max(0, Number(raw) || 0);
  const total = Math.max(claimed, 100); // display baseline 100 target
  return NextResponse.json({ claimed, total });
}
