// apps/web/lib/jwt.ts
import crypto from "crypto";

type JWTPayload = Record<string, any> & {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  exp?: number; // seconds since epoch
  nbf?: number; // not-before (seconds)
  iat?: number; // issued-at (seconds)
};

type VerifyOptions = {
  issuer?: string | string[];
  audience?: string | string[];
  clockToleranceSec?: number; // default 5s
  requireExp?: boolean;       // default false
  requireIat?: boolean;       // default false
  requireNbf?: boolean;       // default false
};

type VerifyResult =
  | { ok: true; payload: JWTPayload; header: { alg: string; typ?: string } }
  | { ok: false; err: "format" | "header" | "alg" | "sig" | "expired" | "notYetValid" | "aud" | "iss" | "iatMissing" | "expMissing" | "nbfMissing" };

function b64urlEncode(buf: Buffer | string) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, "utf8");
  return b
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlDecodeToBuffer(s: string) {
  // restore padding
  const pad = s.length % 4 === 2 ? "==" : s.length % 4 === 3 ? "=" : "";
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(base64, "base64");
}

function b64urlDecodeJSON<T = any>(s: string): T {
  const buf = b64urlDecodeToBuffer(s);
  return JSON.parse(buf.toString("utf8")) as T;
}

/**
 * Issue an HS256-signed JWT. Automatically sets iat and (optional) exp.
 */
export function issueHS256(
  payload: JWTPayload,
  secret: string,
  opts?: { expiresInSec?: number }
) {
  const header = { alg: "HS256", typ: "JWT" as const };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    iat: now,
    ...(opts?.expiresInSec ? { exp: now + Math.max(0, opts.expiresInSec) } : {}),
    ...payload,
  };

  const encHead = b64urlEncode(JSON.stringify(header));
  const encPay = b64urlEncode(JSON.stringify(fullPayload));
  const data = `${encHead}.${encPay}`;

  // Node supports 'base64url' digest output; fall back if needed
  const sig = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${data}.${sig}`;
}

/**
 * Verify an HS256 JWT with optional issuer/audience/nbf checks.
 */
export function verifyHS256(token: string, secret: string, options: VerifyOptions = {}): VerifyResult {
  const [encHead, encPay, sigPart] = token.split(".");
  if (!encHead || !encPay || !sigPart) return { ok: false, err: "format" };

  // Strict header
  let header: { alg: string; typ?: string };
  try {
    header = b64urlDecodeJSON(encHead);
  } catch {
    return { ok: false, err: "header" };
  }
  if (!header || header.alg !== "HS256") return { ok: false, err: "alg" };
  if (header.typ && header.typ !== "JWT") return { ok: false, err: "header" };

  const data = `${encHead}.${encPay}`;

  // Compute expected signature and compare on raw bytes to avoid length shenanigans
  const expectedB64url = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const sigBuf = b64urlDecodeToBuffer(sigPart);
  const expBuf = b64urlDecodeToBuffer(expectedB64url);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, err: "sig" };
  }

  // Decode payload
  let payload: JWTPayload;
  try {
    payload = b64urlDecodeJSON(encPay);
  } catch {
    return { ok: false, err: "format" };
  }

  const now = Math.floor(Date.now() / 1000);
  const skew = Math.max(0, options.clockToleranceSec ?? 5);

  // Required claims
  if (options.requireIat && payload.iat == null) return { ok: false, err: "iatMissing" };
  if (options.requireExp && payload.exp == null) return { ok: false, err: "expMissing" };
  if (options.requireNbf && payload.nbf == null) return { ok: false, err: "nbfMissing" };

  // Time-based checks
  if (payload.nbf != null && now + skew < payload.nbf) {
    return { ok: false, err: "notYetValid" };
  }
  if (payload.exp != null && now - skew > payload.exp) {
    return { ok: false, err: "expired" };
  }

  // Audience check
  if (options.audience) {
    const want = Array.isArray(options.audience) ? options.audience : [options.audience];
    const got = payload.aud == null ? [] : Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const intersects = want.some((w) => got.includes(w));
    if (!intersects) return { ok: false, err: "aud" };
  }

  // Issuer check
  if (options.issuer) {
    const want = Array.isArray(options.issuer) ? options.issuer : [options.issuer];
    if (!payload.iss || !want.includes(payload.iss)) return { ok: false, err: "iss" };
  }

  return { ok: true, payload, header };
}

/* --- Backwards-compatible names (if you already referenced these) --- */
export const signHS256 = issueHS256;
