import crypto from "crypto";

type JwtPayload = Record<string, any> & { exp?: number; iat?: number; sub?: string };

/** base64url encode (no padding) */
function b64url(buf: Buffer | string) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/** base64url decode */
function b64urlDecode(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

/** sign a HS256 JWT */
export function signHS256(payload: JwtPayload, secret: string, ttlSec = 3600): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);

  const body = {
    iat: now,
    exp: now + ttlSec,
    ...payload,
  };

  const encHead = b64url(JSON.stringify(header));
  const encPay = b64url(JSON.stringify(body));
  const data = `${encHead}.${encPay}`;

  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

/** verify a HS256 JWT */
export function verifyHS256(
  token: string,
  secret: string
): { ok: true; payload: JwtPayload } | { ok: false; err: string } {
  try {
    const [encHead, encPay, sig] = token.split(".");
    if (!encHead || !encPay || !sig) return { ok: false, err: "format" };

    const data = `${encHead}.${encPay}`;
    const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url");

    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return { ok: false, err: "sig" };
    }

    const payload = JSON.parse(b64urlDecode(encPay).toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) return { ok: false, err: "expired" };

    return { ok: true, payload };
  } catch (e) {
    return { ok: false, err: "decode" };
  }
}
