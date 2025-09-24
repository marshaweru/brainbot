import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // ensure it’s always fresh

export async function GET() {
  return NextResponse.json({ ok: true, uptime: process.uptime() });
}
