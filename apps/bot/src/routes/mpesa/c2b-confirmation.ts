// apps/bot/src/routes/mpesa/c2b-confirmation.ts
import express, { Request, Response } from "express";
import {
  upgradeUserPlan,
  planFromAmount,
  type PlanTier,
} from "@brainbot/shared";

const router = express.Router();

router.post("/", async (req: Request, res: Response) => {
  // Immediately ACK Safaricom (so they don't retry)
  res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

  try {
    const body = req.body ?? {};
    const telegramId = String(body.BillRefNumber ?? body.billRef ?? "").trim();
    const amountKES = Number(body.Amount ?? body.TransAmount ?? body.amount ?? 0);
    const receipt = String(body.TransID ?? body.transId ?? body.receipt ?? "").trim();

    if (!telegramId || !amountKES) {
      console.warn("[C2B] Missing telegramId/amount", { telegramId, amountKES });
      return;
    }

    const plan = planFromAmount(amountKES);
    if (!plan) {
      console.warn("[C2B] Unknown amount, no plan matched", { amountKES, telegramId, receipt });
      return;
    }

    const tier = plan.code as Exclude<PlanTier, "free">;
    const days = plan.days;

    await upgradeUserPlan(telegramId, tier, {
      days,
      lifetime: tier === "limited",
      receipt,
    });

    console.log("[C2B] Upgraded", { telegramId, tier, days, lifetime: tier === "limited", receipt });
    // TODO: optionally bot.telegram.sendMessage(telegramId, `Your ${plan.label} is active ✅`)
  } catch (err) {
    console.error("[C2B] handler error", err);
  }
});

export default router;
