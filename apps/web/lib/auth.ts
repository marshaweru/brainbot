// apps/web/lib/auth.ts
import type { NextApiRequest, NextApiResponse } from "next";
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
  const same = opts.sameSite ?? "lax";
  parts.push(`SameSite=${same[0].toUpperCase()}${same.slice(1)}`);
  if (opts.secure ?? true) parts.push("Secure");
  if (opts.httpOnly ?? true) parts.push("HttpOnly");
  return parts.join("; ");
}

/* ---------------- config (force non-null types) ---------------- */
const ISSUER = process.env.JWT_ISS || "brainbot";
const AUDIENCE = process.env.JWT_AUD || "brainbot-web";
const secretStr = process.env.JWT_SECRET || "";
if (!secretStr) {
  throw new Error("JWT_SECRET missing");
}
const SECRET: Uint8Array = new TextEncoder().encode(secretStr);

/* ---------------- verify cookie token ---------------- */
export async function getSessionUser(req: NextApiRequest, _res: NextApiResponse) {
  const raw = req.cookies?.token || req.cookies?.auth_token;
  if (!raw) return null;

  try {
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
      roles: payload.roles,
      email: payload.email,
      name: payload.name,
    };
  } catch {
    return null;
  }
}

/* ---------------- issue token ---------------- */
export async function issueJwt(userId: string, extra: Record<string, any> = {}) {
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

/* ---------------- set/clear cookie ---------------- */
export function setAuthCookie(res: NextApiResponse, token: string) {
  const cookie = serializeCookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30d
  });
  res.setHeader("Set-Cookie", cookie);
}

export function clearAuthCookie(res: NextApiResponse) {
  const cookie = serializeCookie("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  res.setHeader("Set-Cookie", cookie);
}
