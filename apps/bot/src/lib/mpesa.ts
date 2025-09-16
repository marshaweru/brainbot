// apps/bot/src/lib/mpesa.ts
// Minimal Daraja client for STK Push with a few quality-of-life upgrades.

type Env = "production" | "sandbox";

const ENV = ((process.env.DARAJA_ENV as Env) || "sandbox").toLowerCase() as Env;
const BASE =
  ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

const CONSUMER_KEY =
  process.env.DARAJA_CONSUMER_KEY ||
  process.env.MPESA_CONSUMER_KEY ||
  "";
const CONSUMER_SECRET =
  process.env.DARAJA_CONSUMER_SECRET ||
  process.env.MPESA_CONSUMER_SECRET ||
  "";
const SHORTCODE =
  process.env.DARAJA_SHORTCODE ||
  process.env.MPESA_SHORTCODE ||
  process.env.PAYBILL ||
  "4168557";
const PASSKEY =
  process.env.DARAJA_PASSKEY ||
  process.env.MPESA_PASSKEY ||
  "";
const CALLBACK_URL =
  process.env.DARAJA_CALLBACK_URL ||
  process.env.MPESA_CALLBACK_URL ||
  "";

// --- tiny utils ----------------------------------------------------------
const TIMEOUT_MS = Math.max(
  5000,
  Number(process.env.DARAJA_HTTP_TIMEOUT_MS ?? 15000)
);

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function withTimeout(p: Promise<Response>, ms = TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  // @ts-ignore node18 fetch supports signal
  return Promise.race([
    p,
    new Promise<Response>((_, rej) =>
      setTimeout(() => rej(new Error(`Daraja request timed out after ${ms}ms`)), ms)
    ),
  ]).finally(() => clearTimeout(id)) as Promise<Response>;
}

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

// --- token cache ---------------------------------------------------------
let cachedToken: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (!CONSUMER_KEY || !CONSUMER_SECRET) {
    throw new Error("Daraja consumer key/secret missing in env");
  }
  if (cachedToken && cachedToken.exp - 30 > nowSec()) return cachedToken.token;

  const url = `${BASE}/oauth/v1/generate?grant_type=client_credentials`;
  const basic = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");

  const res = await withTimeout(
    fetch(url, { method: "GET", headers: { Authorization: `Basic ${basic}` } } as any)
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Daraja token error: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: string };
  cachedToken = {
    token: data.access_token,
    exp: nowSec() + Number(data.expires_in || 3500),
  };
  return cachedToken.token;
}

// --- public helpers ------------------------------------------------------
export function toMSISDN(raw: string): string {
  // Normalize KE numbers into 2547XXXXXXXX
  let s = (raw || "").trim();
  if (!s) throw new Error("Empty phone number");

  s = s.replace(/[^\d]/g, ""); // strip non-digits

  if (s.startsWith("0")) s = "254" + s.slice(1);
  else if (s.startsWith("7")) s = "254" + s;
  else if (s.startsWith("+254")) s = s.slice(1);

  // At this point we want strictly 2547XXXXXXXX (12 digits)
  if (!/^2547\d{8}$/.test(s)) {
    throw new Error(`Invalid KE MSISDN format: ${raw}`);
  }
  return s;
}

type STKPushOpts = {
  amount: number;       // >= 1
  phone: string;        // 2547XXXXXXXX
  accountRef: string;   // e.g. Telegram ID or user id
  description?: string; // shows in M-PESA push
};

type STKPushResp = {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
};

export async function stkPush(opts: STKPushOpts): Promise<STKPushResp> {
  if (!PASSKEY) throw new Error("Daraja passkey missing in env");
  if (!CALLBACK_URL) throw new Error("Daraja callback URL missing in env");
  if (!SHORTCODE) throw new Error("Daraja shortcode missing in env");

  const amount = Math.floor(Number(opts.amount));
  if (!(amount >= 1)) throw new Error("Amount must be >= 1");

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
    AccountReference: String(opts.accountRef).slice(0, 20), // Daraja UI truncates long refs
    TransactionDesc: (opts.description || "BrainBot Plan").slice(0, 40),
  };

  const url = `${BASE}/mpesa/stkpush/v1/processrequest`;

  // tiny retry wrapper for token expiry edge (401)
  const doCall = async (): Promise<Response> => {
    return withTimeout(
      fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      } as any)
    );
  };

  let res = await doCall();

  // If token randomly expired, refresh once and retry.
  if (res.status === 401) {
    cachedToken = null;
    const newToken = await getAccessToken();
    res = await withTimeout(
      fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${newToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      } as any)
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`STK push failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as STKPushResp;
  // Mild sanity check
  if (!data.CheckoutRequestID) {
    throw new Error(`STK push response missing CheckoutRequestID: ${JSON.stringify(data)}`);
  }
  return data;
}
