// apps/web/lib/auth.ts
import type { NextApiRequest, NextApiResponse } from "next";
import type { NextRequest, NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";

/* ---------------- cookie helpers (no deps) ---------------- */
function serializeCookie(
  name: string,
  value: string,
  opts: {
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    path?: string;
    sameSite?: "lax" | "strict" | "none";
    domain?: string;
  } = {}
) {
  const enc = encodeURIComponent;
  const parts = [`${name}=${enc(value)}`];
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  parts.push(`Path=${opts.path ?? "/"}`);
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  const same = (opts.sameSite ?? "lax").toLowerCase() as "lax" | "strict" | "none";
  parts.push(
    `SameSite=${same === "none" ? "None" : same === "strict" ? "Strict" : "Lax"}`
  );
  // Per spec, SameSite=None MUST be Secure
  const secure = same === "none" ? true : opts.secure ?? process.env.NODE_ENV !== "development";
  if (secure) parts.push("Secure");
  if (opts.httpOnly ?? true) parts.push("HttpOnly");
  return parts.join("; ");
}

/* ---------------- config (lazy secret to avoid import-time throw) ---------------- */
const ISSUER = process.env.JWT_ISS || "brainbot";
const AUDIENCE = process.env.JWT_AUD || "brainbot-web";
function getSecret(): Uint8Array {
  const secretStr = process.env.JWT_SECRET || "";
  if (!secretStr) throw new Error("JWT_SECRET missing");
  return new TextEncoder().encode(secretStr);
}

/* ---------------- core verify helper ---------------- */
async function verifyToken(raw: string) {
  const SECRET = getSecret();
  const { payload } = await jwtVerify(raw, SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ["HS256"],
    clockTolerance: 5,
  });
  const id = String(payload.sub ?? payload.id ?? payload.userId ?? "");
  if (!id) return null;
  return {
    id,
    roles: payload.roles as unknown,
    email: (payload as any).email as string | undefined,
    name: (payload as any).name as string | undefined,
  };
}

/* ---------------- Pages Router: verify from cookie ---------------- */
export async function getSessionUser(req: NextApiRequest, _res: NextApiResponse) {
  const raw = req.cookies?.token || req.cookies?.auth_token;
  if (!raw) return null;
  try {
    return await verifyToken(raw);
  } catch {
    return null;
  }
}

/* ---------------- App Router: verify from NextRequest ---------------- */
export async function getSessionUserFromRequest(req: NextRequest) {
  const raw = req.cookies.get("token")?.value || req.cookies.get("auth_token")?.value;
  if (!raw) return null;
  try {
    return await verifyToken(raw);
  } catch {
    return null;
  }
}

/* ---------------- issue token ---------------- */
export async function issueJwt(userId: string, extra: Record<string, any> = {}) {
  const SECRET = getSecret();
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ ...extra })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime("30d")
    .sign(SECRET);
}

/* ---------------- Pages Router: set/clear cookie ---------------- */
export function setAuthCookie(res: NextApiResponse, token: string, opts?: { domain?: string }) {
  const cookie = serializeCookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30d
    domain: opts?.domain,
  });
  res.setHeader("Set-Cookie", cookie);
}

export function clearAuthCookie(res: NextApiResponse, opts?: { domain?: string }) {
  const cookie = serializeCookie("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    domain: opts?.domain,
  });
  res.setHeader("Set-Cookie", cookie);
}

/* ---------------- App Router: set/clear cookie on NextResponse ---------------- */
export function setAuthCookieOnResponse(res: NextResponse, token: string, opts?: { domain?: string }) {
  // Use NextResponse.cookies to avoid manual header juggling
  res.cookies.set({
    name: "token",
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    domain: opts?.domain,
  });
  return res;
}

export function clearAuthCookieOnResponse(res: NextResponse, opts?: { domain?: string }) {
  res.cookies.set({
    name: "token",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    domain: opts?.domain,
  });
  return res;
}
