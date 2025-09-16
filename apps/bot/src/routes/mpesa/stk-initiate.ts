// apps/bot/src/routes/mpesa/stk-initiate.ts
import express, { Request, Response, NextFunction } from "express";
import { stkPush, toMSISDN } from "../../lib/mpesa";

export const router = express.Router();

/* ---------------- s2s auth (web → bot) ---------------- */
function assertServiceAuth(req: Request) {
  const hdr = req.get("authorization") || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : "";
  if (!token || token !== (process.env.SERVICE_TOKEN || "")) {
    const err: any = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
}

/* ---------------- fail fast on MPESA env ---------------- */
function assertMpesaEnv() {
  const missing: string[] = [];
  if (!process.env.MPESA_CONSUMER_KEY) missing.push("MPESA_CONSUMER_KEY");
  if (!process.env.MPESA_CONSUMER_SECRET) missing.push("MPESA_CONSUMER_SECRET");
  if (!process.env.MPESA_SHORTCODE) missing.push("MPESA_SHORTCODE");
  if (!process.env.MPESA_PASSKEY) missing.push("MPESA_PASSKEY");
  if ((process.env.MPESA_ENV || "sandbox") === "production" && !process.env.MPESA_CALLBACK_URL) {
    missing.push("MPESA_CALLBACK_URL");
  }
  if (missing.length) {
    const err: any = new Error(`Missing MPESA env: ${missing.join(", ")}`);
    err.statusCode = 500;
    throw err;
  }
}

/* ---------------- tiny in-memory rate limiter ---------------- */
type Bucket = { count: number; reset: number };
const ipBuckets = new Map<string, Bucket>();
const acctBuckets = new Map<string, Bucket>();

function rateLimit(opts: { windowMs: number; maxPerIp: number; maxPerAccount: number }) {
  const { windowMs, maxPerIp, maxPerAccount } = opts;
  let sweepEvery = 0;

  function take(map: Map<string, Bucket>, key: string, max: number, now: number): number {
    let b = map.get(key);
    if (!b || now > b.reset) {
      b = { count: 0, reset: now + windowMs };
      map.set(key, b);
    }
    if (b.count >= max) return Math.ceil((b.reset - now) / 1000);
    b.count++;
    return 0;
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = (req.ip || req.headers["x-forwarded-for"] || "unknown").toString();
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

    // periodic GC
    if (++sweepEvery % 200 === 0) {
      const gc = (m: Map<string, Bucket>) => {
        const t = Date.now();
        for (const [k, v] of m) if (t > v.reset) m.delete(k);
      };
      gc(ipBuckets);
      gc(acctBuckets);
      if (sweepEvery > 10_000) sweepEvery = 0;
    }

    next();
  };
}

/* ---------------- amount whitelist ---------------- */
const ALLOWED_AMOUNTS = new Set([69, 499, 1499, 2999, 5999]); // KES

function validateAmount(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid amount");
  if (!ALLOWED_AMOUNTS.has(n)) {
    const err: any = new Error(
      `Amount not allowed. Allowed: ${Array.from(ALLOWED_AMOUNTS).join(", ")}`
    );
    err.statusCode = 400;
    throw err;
  }
  return n;
}

/* ---------------- route ---------------- */
router.post(
  "/",
  rateLimit({ windowMs: 60_000, maxPerIp: 5, maxPerAccount: 3 }),
  async (req: Request, res: Response) => {
    try {
      assertServiceAuth(req);
      assertMpesaEnv();

      const { phone, amount, accountRef, description } = req.body || {};
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

      return res.json({
        ok: true,
        checkout: resp.CheckoutRequestID,
        message: resp.CustomerMessage,
      });
    } catch (e: any) {
      const status = e?.statusCode || 500;
      return res.status(status).json({ ok: false, error: e?.message || "init failed" });
    }
  }
);
