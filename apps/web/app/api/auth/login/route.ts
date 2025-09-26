// apps/web/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { setAuthCookieOnResponse } from "@/lib/auth";

const ISSUER = process.env.JWT_ISS || "brainbot";
const AUDIENCE = process.env.JWT_AUD || "brainbot-web";

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET || "";
  if (!s) throw new Error("JWT_SECRET missing");
  return new TextEncoder().encode(s);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") || "";
  const redirect = searchParams.get("redirect") || "/";

  if (!token) return NextResponse.json({ ok: false, error: "missing token" }, { status: 400 });

  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
      clockTolerance: 5,
    });
    const userId = String(payload.sub ?? payload.userId ?? payload.id ?? "");
    if (!userId) return NextResponse.json({ ok: false, error: "invalid subject" }, { status: 401 });

    const res = NextResponse.redirect(new URL(redirect, req.url));
    setAuthCookieOnResponse(res, token);
    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "verify_failed" }, { status: 401 });
  }
}
