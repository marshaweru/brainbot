// app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getSessionUserFromRequest(req as any);
  return NextResponse.json({ ok: true, user: user ?? null });
}
