import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("bb_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  return res;
}
