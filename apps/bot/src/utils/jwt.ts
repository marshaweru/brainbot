import crypto from "crypto";

export function verifyHS256(token: string, secret: string):
  | { ok: true; payload: any }
  | { ok: false; err: string } {
  const [encHead, encPay, sig] = token.split(".");
  if (!encHead || !encPay || !sig) return { ok: false, err: "format" };
  const data = `${encHead}.${encPay}`;
  const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return { ok: false, err: "sig" };
  const payload = JSON.parse(Buffer.from(encPay, "base64").toString("utf8"));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return { ok: false, err: "expired" };
  return { ok: true, payload };
}
