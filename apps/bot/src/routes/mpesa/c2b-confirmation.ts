// routes/mpesa/c2b-confirmation.ts
import express, { type Request, type Response } from "express";
import { planFromAmount, upgradeUserPlan } from "../../repo/planRepo";
import { recordPaymentIfNew } from "../../repo/paymentRepo";

export const router = express.Router();

router.post("/", async (req: Request, res: Response) => {
  // ACK immediately to stop Daraja retries
  res.json({ ok: true });

  (async () => {
    try {
      const body = req.body;
      const cb = body?.Body?.stkCallback;
      if (!cb) return;

      const resultCode = Number(cb?.ResultCode ?? 1);
      const resultDesc = String(cb?.ResultDesc || "");
      const checkoutId = cb?.CheckoutRequestID || null; // top-level
      if (resultCode !== 0) {
        console.error("❌ STK failed:", resultDesc, checkoutId ? `[checkout ${checkoutId}]` : "");
        return;
      }

      // Extract metadata items
      const items = (cb?.CallbackMetadata?.Item ?? []) as Array<{ Name: string; Value: any }>;
      const pick = (name: string) => items.find(i => i.Name === name)?.Value;

      const amount = Number(pick("Amount"));
      const accountRef = String(pick("AccountReference") || "");
      const receipt = (pick("MpesaReceiptNumber") ?? null) as string | null;
      const txDateRaw = pick("TransactionDate") ?? null; // 20250101123456

      if (!amount || isNaN(amount)) {
        console.error("❌ STK callback missing/invalid Amount:", items);
        return;
      }
      if (!accountRef) {
        console.error("❌ STK callback missing AccountReference (Telegram ID):", items);
        return;
      }

      const mapping = planFromAmount(amount);
      if (!mapping) {
        console.error("❌ Unknown payment amount:", amount);
        return;
      }
      const { tier, days } = mapping;

      // Idempotent write: only the first insert "wins"
      const rec = await recordPaymentIfNew({
        telegramId: accountRef,
        amount,
        tier,
        days,
        checkoutId,
        receipt,
        txDateRaw,
        raw: body,
      });

      if (!rec.created) {
        console.log(
          `ℹ️ Duplicate payment callback ignored for ${accountRef} — ` +
          `receipt=${receipt ?? "n/a"} checkout=${checkoutId ?? "n/a"}`
        );
        return;
      }

      // First time we see this payment → upgrade
      await upgradeUserPlan(accountRef, tier, { days });

      console.log(
        `🎉 Upgraded ${accountRef} → ${tier} (${days} days) [KES ${amount}] ` +
        `${receipt ? `receipt ${receipt} ` : ""}${checkoutId ? `checkout ${checkoutId}` : ""}`
      );
    } catch (err) {
      console.error("💥 STK callback handler error:", err);
    }
  })();
});
