// apps/bot/src/routes/mpesa/stk-initiate.ts
import express, { Request, Response, NextFunction } from "express";
import { stkPush, toMSISDN } from "../../lib/mpesa.js";

export const router = express.Router();

/* ---------------- utils ---------------- */
const jsonOnly = (req: Request, res: Response, next: NextFunction) => {
  const ct = req.headers["content-type"] || "";
  if (typeof ct === "string" && ct.includes("application/json")) return next();
  return res.status(415).json({ ok: false, error: "content-type must be application/json" });
};

const bearerToken = (req: Request) => {
  const hdr = req.get("authorization") || "";
  return hdr.startsWith("Bearer ") ? hdr.slice(7) : "";
};

/* ---------------- s2s auth (web → bot) ---------------- */
function requireServiceAuth(req: Request, res: Response, next: NextFunction) {
  const token = bearerToken(req);
  const expected = process.env.SERVICE_TOKEN || "";
  if (!token || token !== expected) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="brainbot", error="invalid_token"');
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

/* ---------------- MPESA env sanity ---------------- */
function assertMpesaEnv() {
  // Support both DARAJA_* and MPESA_* names
  const key     = process.env.DARAJA_CONSUMER_KEY    ?? process.env.MPESA_CONSUMER_KEY;
  const secret  = process.env.DARAJA_CONSUMER_SECRET ?? process.env.MPESA_CONSUMER_SECRET;
  const shortCd = process.env.MPESA_SHORTCODE        ?? process.env.DARAJA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY          ?? process.env.DARAJA_PASSKEY;
  const env     = (process.env.DARAJA_ENV ?? process.env.MPESA_ENV ?? "sandbox").toLowerCase();
  const cbUrl   = process.env.DARAJA_CALLBACK_URL    ?? process.env.MPESA_CALLBACK_URL;

  const missing: string[] = [];
  if (!key)     missing.push("DARAJA_CONSUMER_KEY/MPESA_CONSUMER_KEY");
  if (!secret)  missing.push("DARAJA_CONSUMER_SECRET/MPESA_CONSUMER_SECRET");
  if (!shortCd) missing.push("MPESA_SHORTCODE/DARAJA_SHORTCODE");
  if (!passkey) missing.push("MPESA_PASSKEY/DARAJA_PASSKEY");
  if (env === "production" && !cbUrl) missing.push("DARAJA_CALLBACK_URL/MPESA_CALLBACK_URL");

  if (missing.length) {
    const e: any = new Error(`Missing MPESA env: ${missing.join(", ")}`);
    e.statusCode = 500;
    throw e;
  }
}

/* ---------------- tiny in-memory rate limiter ---------------- */
type Bucket = { count: number; reset: number };
const ipBuckets = new Map<string, Bucket>();
const acctBuckets = new Map<string, Bucket>();

function rateLimit(opts: { windowMs: number; maxPerIp: number; maxPerAccount: number }) {
  const { windowMs, maxPerIp, maxPerAccount } = opts;
  let tick = 0;

  const take = (map: Map<string, Bucket>, key: string, max: number, now: number): number => {
    const b = map.get(key);
    if (!b || now > b.reset) {
      map.set(key, { count: 1, reset: now + windowMs });
      return 0;
    }
    if (b.count >= max) return Math.ceil((b.reset - now) / 1000);
    b.count += 1;
    return 0;
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = (req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || "unknown");
    const accountRef = typeof req.body?.accountRef === "string" ? req.body.accountRef : "";

    const ipRetry = take(ipBuckets, ip, maxPerIp, now);
    if (ipRetry > 0) {
      res.setHeader("Retry-After", String(ipRetry));
      return res.status(429).json({ ok: false, error: `Too many requests from your IP. Try again in ${ipRetry}s.` });
    }

    if (accountRef) {
      const acctRetry = take(acctBuckets, accountRef, maxPerAccount, now);
      if (acctRetry > 0) {
        res.setHeader("Retry-After", String(acctRetry));
        return res.status(429).json({ ok: false, error: `Too many requests for this account. Try again in ${acctRetry}s.` });
      }
    }

    // periodic garbage collection
    if (++tick % 200 === 0) {
      const gc = (m: Map<string, Bucket>) => {
        const t = Date.now();
        for (const [k, v] of m) if (t > v.reset) m.delete(k);
      };
      gc(ipBuckets);
      gc(acctBuckets);
      if (tick > 10_000) tick = 0;
    }

    next();
  };
}

/* ---------------- amount whitelist ---------------- */
const ALLOWED_AMOUNTS = new Set([69, 499, 1499, 2999, 5999]); // KES

function validateAmount(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw Object.assign(new Error("invalid amount"), { statusCode: 400 });
  if (!ALLOWED_AMOUNTS.has(n)) {
    const e: any = new Error(`amount not allowed; allowed: ${[...ALLOWED_AMOUNTS].join(", ")}`);
    e.statusCode = 400;
    throw e;
  }
  return n;
}

/* ---------------- route ---------------- */
router.post(
  "/",
  jsonOnly,
  requireServiceAuth,
  rateLimit({ windowMs: 60_000, maxPerIp: 5, maxPerAccount: 3 }),
  async (req: Request, res: Response) => {
    try {
      assertMpesaEnv();

      const { phone, amount, accountRef, description } = req.body ?? {};
      if (!phone || !amount || !accountRef) {
        return res.status(400).json({ ok: false, error: "phone, amount, accountRef required" });
      }

      const msisdn = toMSISDN(String(phone));
      const amt = validateAmount(amount);

      const resp = await stkPush({
        amount: amt,
        phone: msisdn,
        accountRef: String(accountRef),
        description: description ? String(description) : undefined,
      });

      // Typical Daraja STK response fields:
      // { MerchantRequestID, CheckoutRequestID, ResponseCode, ResponseDescription, CustomerMessage }
      return res.json({
        ok: true,
        checkout: resp.CheckoutRequestID,
        message: resp.CustomerMessage ?? "STK push sent",
      });
    } catch (e: any) {
      const status = e?.statusCode || 500;
      return res.status(status).json({ ok: false, error: e?.message || "stk-initiate failed" });
    }
  }
);

export default router;
