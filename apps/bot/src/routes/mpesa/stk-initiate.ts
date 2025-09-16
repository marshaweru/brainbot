// apps/bot/src/routes/mpesa/stk-initiate.ts
import express, { Request, Response } from "express";
import { stkPush, toMSISDN } from "../../lib/mpesa"; // ✅ fixed path

export const router = express.Router();

// super simple service-to-service auth (web → bot)
function assertServiceAuth(req: Request) {
  const hdr = req.get("authorization") || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : "";
  const expected = process.env.SERVICE_TOKEN || "";
  if (!token || token !== expected) {
    const err: any = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
}

router.post("/", async (req: Request, res: Response) => {
  try {
    assertServiceAuth(req);

    const { phone, amount, accountRef, description } = req.body || {};
    if (!phone || !amount || !accountRef) {
      return res.status(400).json({ ok: false, error: "phone, amount, accountRef required" });
    }

    const msisdn = toMSISDN(String(phone));
    const resp = await stkPush({
      amount: Number(amount),
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
    const status = e?.statusCode || 400;
    return res.status(status).json({ ok: false, error: e?.message || "init failed" });
  }
});
