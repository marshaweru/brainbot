import express, { type Request, type Response } from "express";
import { planFromAmount, upgradeUserPlan } from "../../repo/planRepo";

export const router = express.Router();

router.post("/", async (req: Request, res: Response) => {
  // respond immediately to Daraja
  res.json({ ok: true });

  (async () => {
    try {
      const body = req.body;
      const cb = body?.Body?.stkCallback;
      if (!cb) return;

      const resultCode = Number(cb?.ResultCode ?? 1);
      const resultDesc = String(cb?.ResultDesc || "");

      if (resultCode !== 0) {
        console.error("❌ STK failed:", resultDesc);
        return;
      }

      // Extract metadata
      const items = (cb?.CallbackMetadata?.Item ?? []) as Array<{ Name: string; Value: any }>;
      let amount: number | null = null;
      let accountRef: string | null = null; // we pass Telegram ID here during STK init

      for (const it of items) {
        if (it.Name === "Amount") amount = Number(it.Value);
        if (it.Name === "AccountReference") accountRef = String(it.Value);
      }

      if (amount == null) {
        console.error("❌ STK callback missing Amount:", items);
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

      await upgradeUserPlan(accountRef, tier, { days });

      console.log(`🎉 Upgraded ${accountRef} → ${tier} (${days} days) [KES ${amount}]`);
    } catch (err) {
      console.error("💥 STK callback handler error:", err);
    }
  })();
});
