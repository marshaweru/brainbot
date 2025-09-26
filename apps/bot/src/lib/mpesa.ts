// apps/bot/src/lib/mpesa.ts
// Daraja (M-PESA) STK Push client with guarded envs, timeouts, and structured errors.

type Env = "production" | "sandbox";

const ENV = ((process.env.MPESA_ENV || process.env.DARAJA_ENV || "sandbox") as string)
  .toLowerCase() as Env;

const BASE =
  ENV === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

const CONSUMER_KEY =
  process.env.MPESA_CONSUMER_KEY || process.env.DARAJA_CONSUMER_KEY || "";
const CONSUMER_SECRET =
  process.env.MPESA_CONSUMER_SECRET || process.env.DARAJA_CONSUMER_SECRET || "";
const SHORTCODE =
  process.env.MPESA_SHORTCODE || process.env.DARAJA_SHORTCODE || process.env.PAYBILL || "4168557";
const PASSKEY = process.env.MPESA_PASSKEY || process.env.DARAJA_PASSKEY || "";
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL || process.env.DARAJA_CALLBACK_URL || "";

// Optional: shared secret that Daraja will include back to you (proxy via gateway)
const CALLBACK_SECRET = (process.env.MPESA_CALLBACK_SECRET || "").trim();

// Debug: set MPESA_DEBUG=1 to log sanitized payloads/responses
const DEBUG = (process.env.MPESA_DEBUG || "") === "1";

// Tunables
const TIMEOUT_MS = Math.max(5_000, Number(process.env.MPESA_HTTP_TIMEOUT_MS ?? 15_000));
const USER_AGENT = "BrainBot/1.0 (+https://brainbot.africa)";

// ---------- utils ----------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nowSec = () => Math.floor(Date.now() / 1000);

function yyyymmddHHMMSS(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

async function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    // @ts-ignore: Node 18 fetch supports signal
    return await (p as any);
  } finally {
    clearTimeout(t);
  }
}

// ---------- Error taxonomy ----------
export class MpesaError extends Error {
  kind:
    | "env"
    | "auth"
    | "timeout"
    | "http"
    | "bad_response"
    | "validation"
    | "unknown";
  status?: number;
  body?: string;
  constructor(msg: string, kind: MpesaError["kind"], extra?: Partial<MpesaError>) {
    super(msg);
    this.name = "MpesaError";
    this.kind = kind;
    Object.assign(this, extra);
  }
}

function assertEnv() {
  const missing: string[] = [];
  if (!CONSUMER_KEY) missing.push("MPESA_CONSUMER_KEY");
  if (!CONSUMER_SECRET) missing.push("MPESA_CONSUMER_SECRET");
  if (!PASSKEY) missing.push("MPESA_PASSKEY");
  if (!SHORTCODE) missing.push("MPESA_SHORTCODE/PAYBILL");
  if (!CALLBACK_URL) missing.push("MPESA_CALLBACK_URL");
  if (missing.length) {
    throw new MpesaError(`Missing env: ${missing.join(", ")}`, "env");
  }
}

// ---------- OAuth token cache ----------
let cachedToken: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  assertEnv();
  if (cachedToken && cachedToken.exp - 30 > nowSec()) return cachedToken.token;

  const url = `${BASE}/oauth/v1/generate?grant_type=client_credentials`;
  const basic = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");

  let res: Response;
  try {
    res = await withTimeout(
      fetch(url, { method: "GET", headers: { Authorization: `Basic ${basic}`, "User-Agent": USER_AGENT } } as any),
      TIMEOUT_MS
    );
  } catch (e: any) {
    throw new MpesaError(`Token timeout: ${e?.message || e}`, "timeout");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new MpesaError(`Token HTTP ${res.status}: ${text.slice(0, 300)}`, "auth", {
      status: res.status,
      body: text,
    });
  }

  const data = (await res.json()) as { access_token: string; expires_in: string };
  if (!data?.access_token) {
    throw new MpesaError("Token response missing access_token", "bad_response");
  }
  cachedToken = { token: data.access_token, exp: nowSec() + Number(data.expires_in || 3500) };
  return cachedToken.token;
}

// ---------- Public helpers ----------
export function toMSISDN(raw: string): string {
  let s = (raw || "").trim();
  if (!s) throw new MpesaError("Empty phone number", "validation");

  s = s.replace(/[^\d+]/g, "");

  if (s.startsWith("+254")) s = s.slice(1);
  else if (s.startsWith("0")) s = "254" + s.slice(1);
  else if (s.startsWith("7")) s = "254" + s;

  if (!/^2547\d{8}$/.test(s)) {
    throw new MpesaError(`Invalid KE MSISDN: ${raw}`, "validation");
  }
  return s;
}

export type STKPushOpts = {
  amount: number; // >= 1
  phone: string; // 2547XXXXXXXX
  accountRef: string; // user/telegram id
  description?: string; // shows in M-PESA push (<= 40 chars)
};

export type STKPushResp = {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
};

function sanitizePayloadForLog(p: any) {
  if (!DEBUG) return;
  const clone = { ...(p || {}) };
  if (clone.PhoneNumber) clone.PhoneNumber = "2547********";
  console.log("[mpesa] payload:", JSON.stringify(clone));
}

// ---------- Core: STK Push ----------
export async function stkPush(opts: STKPushOpts): Promise<STKPushResp> {
  assertEnv();

  const amount = Math.floor(Number(opts.amount));
  if (!(amount >= 1)) throw new MpesaError("Amount must be >= 1", "validation");

  const phone = toMSISDN(opts.phone);
  const token = await getAccessToken();

  const timestamp = yyyymmddHHMMSS();
  const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString("base64");

  const payload = {
    BusinessShortCode: Number(SHORTCODE),
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: phone,
    PartyB: Number(SHORTCODE),
    PhoneNumber: phone,
    CallBackURL: CALLBACK_URL,
    AccountReference: String(opts.accountRef).slice(0, 20),
    TransactionDesc: (opts.description || "BrainBot Plan").slice(0, 40),
  };

  sanitizePayloadForLog(payload);

  const url = `${BASE}/mpesa/stkpush/v1/processrequest`;

  const attempt = async (bearer: string): Promise<Response> =>
    withTimeout(
      fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
          ...(CALLBACK_SECRET ? { "X-Callback-Secret": CALLBACK_SECRET } : {}),
        },
        body: JSON.stringify(payload),
      } as any),
      TIMEOUT_MS
    );

  let res: Response;
  try {
    res = await attempt(token);
  } catch (e: any) {
    throw new MpesaError(`STK timeout: ${e?.message || e}`, "timeout");
  }

  // If token expired, refresh once and retry with a small backoff
  if (res.status === 401) {
    cachedToken = null;
    await sleep(200);
    const newToken = await getAccessToken();
    try {
      res = await attempt(newToken);
    } catch (e: any) {
      throw new MpesaError(`STK timeout (retry): ${e?.message || e}`, "timeout");
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Daraja tends to return JSON like { errorCode, errorMessage }
    let msg = text.slice(0, 400);
    try {
      const j = JSON.parse(text);
      if (j?.errorMessage) msg = `${j.errorCode || res.status} ${j.errorMessage}`;
    } catch {}
    throw new MpesaError(`STK HTTP ${res.status}: ${msg}`, "http", { status: res.status, body: text });
  }

  const data = (await res.json()) as STKPushResp;
  if (!data?.CheckoutRequestID) {
    throw new MpesaError(
      `STK response missing CheckoutRequestID: ${JSON.stringify(data).slice(0, 400)}`,
      "bad_response"
    );
  }

  if (DEBUG) console.log("[mpesa] response:", JSON.stringify(data));
  return data;
}
