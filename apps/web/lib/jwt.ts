import crypto from "crypto";

function b64url(buf: Buffer | string) {
  return Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function signHS256(payload: Record<string, any>, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };
  const encHead = b64url(JSON.stringify(header));
  const encPay  = b64url(JSON.stringify(payload));
  const data = `${encHead}.${encPay}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyHS256(token: string, secret: string) {
  const [encHead, encPay, sig] = token.split(".");
  if (!encHead || !encPay || !sig) return { ok: false as const, err: "format" };
  const data = `${encHead}.${encPay}`;
  const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return { ok: false as const, err: "sig" };
  const payload = JSON.parse(Buffer.from(encPay, "base64").toString("utf8"));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return { ok: false as const, err: "expired" };
  return { ok: true as const, payload };
}
