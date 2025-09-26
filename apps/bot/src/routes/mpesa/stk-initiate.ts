// apps/bot/src/routes/mpesa/stk-initiate.ts
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { stkPush, toMSISDN } from "../../lib/mpesa.js";

export const router = Router();

/* ---------------- utils ---------------- */
const jsonOnly = (req: Request, res: Response, next: NextFunction) => {
  const ct = (req.headers["content-type"] || "").toString().toLowerCase();
  if (ct.includes("application/json")) return next();
  return res.status(415).json({ ok: false, error: "content-type must be application/json" });
};

const bearerToken = (req: Request) => {
  const hdr = req.get("authorization") || "";
  return hdr.startsWith("Bearer ") ? hdr.slice(7) : "";
};

const reqId = () =>
  Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);

/* ---------------- s2s auth (web → bot) ---------------- */
function requireServiceAuth(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.SERVICE_TOKEN || "";
  const token = bearerToken(req);
  if (!expected || token !== expected) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="brainbot", error="invalid_token"');
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

/* ---------------- optional HMAC signature (tamper check) ----------------
   - If SERVICE_HMAC_SECRET is set, require X-BrainBot-Signature header.
   - Signature = "sha256=" + hex( HMAC_SHA256(secret, rawBody) )
   Make sure your Express app enables raw body for this route if you want
   strict verification; otherwise we hash JSON.stringify(req.body).
------------------------------------------------------------------------- */
function verifySignature(secret: string, req: Request): boolean {
  try {
    const sent = (req.get("x-brainbot-signature") || "").trim();
    if (!sent.startsWith("sha256=")) return false;
    const raw =
      (req as any).rawBody instanceof Buffer
        ? (req as any).rawBody
        : Buffer.from(JSON.stringify(req.body ?? {}));
    const digest = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    const expected = `sha256=${digest}`;
    // timing-safe compare
    return crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
  } catch {
    return false;
  }
}

function requireOptionalHmac(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.SERVICE_HMAC_SECRET || "";
  if (!secret) return next(); // feature off
  if (verifySignature(secret, req)) return next();
  return res.status(401).json({ ok: false, error: "bad signature" });
}

/* ---------------- MPESA env sanity ---------------- */
function assertMpesaEnv() {
  // Support both DARAJA_* and MPESA_*
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
    const ip =
      (req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
        req.ip ||
        "unknown");
    const accountRef = typeof req.body?.accountRef === "string" ? req.body.accountRef : "";

    const ipRetry = take(ipBuckets, ip, maxPerIp, now);
    if (ipRetry > 0) {
      res.setHeader("Retry-After", String(ipRetry));
      return res
        .status(429)
        .json({ ok: false, error: `Too many requests from your IP. Try again in ${ipRetry}s.` });
    }

    if (accountRef) {
      const acctRetry = take(acctBuckets, accountRef, maxPerAccount, now);
      if (acctRetry > 0) {
        res.setHeader("Retry-After", String(acctRetry));
        return res
          .status(429)
          .json({
            ok: false,
            error: `Too many requests for this account. Try again in ${acctRetry}s.`,
          });
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
  if (!Number.isFinite(n) || n <= 0)
    throw Object.assign(new Error("invalid amount"), { statusCode: 400 });
  if (!ALLOWED_AMOUNTS.has(n)) {
    const e: any = new Error(
      `amount not allowed; allowed: ${[...ALLOWED_AMOUNTS].join(", ")}`
    );
    e.statusCode = 400;
    throw e;
  }
  return n;
}

/* ---------------- idempotency ---------------- */
type Stamp = { at: number; resp: any };
const IDEMP_TTL = 10 * 60_000; // 10 min
const idem = new Map<string, Stamp>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of idem) if (now - v.at > IDEMP_TTL) idem.delete(k);
}, 60_000).unref?.();

/* ---------------- validation helpers ---------------- */
type BodyIn = {
  phone?: unknown;
  amount?: unknown;
  accountRef?: unknown;
  description?: unknown;
};

function readBody(body: BodyIn) {
  const phone = String(body?.phone ?? "").trim();
  const amount = body?.amount;
  const accountRef = String(body?.accountRef ?? "").trim();
  const description =
    body?.description == null ? undefined : String(body.description).slice(0, 160);

  if (!phone || !amount || !accountRef) {
    const e: any = new Error("phone, amount, accountRef required");
    e.statusCode = 400;
    throw e;
  }

  const msisdn = toMSISDN(phone);
  const amt = validateAmount(amount);

  return { msisdn, amt, accountRef, description };
}

/* ---------------- route ---------------- */
router.post(
  "/",
  jsonOnly,
  requireServiceAuth,
  requireOptionalHmac, // requires SERVICE_HMAC_SECRET + X-BrainBot-Signature
  rateLimit({ windowMs: 60_000, maxPerIp: 5, maxPerAccount: 3 }),
  async (req: Request, res: Response) => {
    const rid = reqId();
    try {
      assertMpesaEnv();

      const { msisdn, amt, accountRef, description } = readBody(req.body as BodyIn);

      // Prefer client-supplied idempotency key (recommended for retries)
      const headerKey = (req.get("Idempotency-Key") || "").trim().toLowerCase();
      const ip = (req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || "unknown").toString();
      // Composite fallback key: account + amount + phone (and ip to reduce collisions)
      const fallbackKey = `${accountRef}:${amt}:${msisdn}:${ip}`;
      const key = headerKey || fallbackKey;

      // serve cached response if within TTL
      const cached = idem.get(key);
      if (cached && Date.now() - cached.at < IDEMP_TTL) {
        return res.status(200).json({ ok: true, requestId: rid, cached: true, ...cached.resp });
      }

      const mpesaResp = await stkPush({
        amount: amt,
        phone: msisdn,
        accountRef,
        description,
      });

      const resp = {
        ok: true,
        requestId: rid,
        checkout: mpesaResp.CheckoutRequestID,
        message: mpesaResp.CustomerMessage ?? "STK push sent",
      };

      idem.set(key, { at: Date.now(), resp });
      return res.json(resp);
    } catch (e: any) {
      const status = Number(e?.statusCode || 500);
      const message = String(e?.message || "stk-initiate failed");
      return res.status(status).json({ ok: false, error: message, requestId: rid });
    }
  }
);

export default router;
