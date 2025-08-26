// apps/bot/src/routes/mpesa/c2b-confirmation.ts
import express, { Request, Response } from "express";
import { getCollections, getUserSession } from "../../lib/db";
import { Plans, addDays } from "@brainbot/shared";
import { sendTelegramMessage } from "../../lib/telegram";

export const router = express.Router();

type PlanCode = keyof typeof Plans;
type PlanRec = (typeof Plans)[PlanCode];
type SelectedPlan = { code: PlanCode } & PlanRec;

function normalizeAmount(a: any): number {
  // Accept: numbers, "2999", "2,999", "2999.00", "KES 2,999", etc.
  if (a == null) return NaN;
  const s = String(a).replace(/[^0-9.]/g, ""); // strip currency, spaces, commas
  const n = Number(s);
  return Number.isNaN(n) ? NaN : Math.round(n);
}

function getPlanByAmount(amountKes: number): SelectedPlan | null {
  const entry = (Object.entries(Plans) as [PlanCode, PlanRec][])
    .find(([, p]) => p.amount === amountKes);
  return entry ? ({ code: entry[0], ...entry[1] }) : null;
}

router.post("/", async (req: Request, res: Response) => {
  // Respond ASAP so Safaricom doesn’t retry
  res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

  try {
    const body = req.body || {};

    // Handle typical and lowercase variants defensively
    const billRefNumber = String(
      body?.BillRefNumber ?? body?.billRefNumber ?? body?.AccountReference ?? ""
    ).trim();

    const amount = normalizeAmount(
      body?.TransAmount ?? body?.transAmount ?? body?.Amount ?? body?.amount
    );

    const transID = String(
      body?.TransID ?? body?.transID ?? body?.TransactionID ?? body?.transactionId ?? ""
    ).trim();

    const msisdn = String(body?.MSISDN ?? body?.msisdn ?? body?.Sender ?? body?.sender ?? "").trim();
    const firstName = String(body?.FirstName ?? body?.firstName ?? "");
    const lastName = String(body?.LastName ?? body?.lastName ?? "");
    const adminId = process.env.TG_ADMIN_ID || "7959124324";

    // telemetry helpers (additive; safe)
    const ip = req.headers["x-forwarded-for"]?.toString() || req.ip || "";
    const userAgent = req.headers["user-agent"] || "";

    // Notify admin (single compact message)
    await sendTelegramMessage(
      adminId,
      [
        `🚨 *C2B Payment*`,
        "```json",
        JSON.stringify(
          { billRefNumber, amount, transID, msisdn, firstName, lastName, ip },
          null,
          2
        ),
        "```",
      ].join("\n")
    );

    if (!billRefNumber || !amount || Number.isNaN(amount)) return;

    const { users, payments, settings } = await getCollections();

    // idempotency
    const existing = await payments.findOne({ transID });
    if (existing) return;

    // match plan by exact amount
    let selected = getPlanByAmount(amount);
    if (!selected) {
      await payments.insertOne({
        transID, billRefNumber, amount, matched: false, channel: "mpesa_c2b",
        ts: new Date(), ip, userAgent, raw: body
      });
      await sendTelegramMessage(
        billRefNumber,
        `⚠️ Payment (KES ${amount}) didn’t match a BrainBot plan.`
      );
      return;
    }

    // first-100 gating (safe on null)
    if ((selected.code as string).toUpperCase() === "FIRST100") {
      const gate = await settings.findOneAndUpdate(
        { key: "first100-counter" },
        { $inc: { count: 1 } },
        { upsert: true, returnDocument: "after" }
      );
      const count = (gate?.value?.count ?? 0) as number;
      if (count > 100) {
        await sendTelegramMessage(
          billRefNumber,
          `⏳ KES 1,499 founder deal sold out. Crediting **Plus (Month)** instead.`
        );
        selected = { code: "PLUS_MONTH" as PlanCode, ...Plans.PLUS_MONTH };
      }
    }

    // ensure user
    let user = await getUserSession(billRefNumber);
    if (!user) {
      await users.insertOne({
        telegramId: billRefNumber,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPaid: false,
        plan: null,
        daily: { date: null, minutesUsed: 0, subjectsDone: 0 },
        referral: { referrerId: null, paidReferrals: 0, hasPaid: false },
        autoCreatedFromPayment: true
      });
      user = await users.findOne({ telegramId: billRefNumber });
    }
    if (!user) return;

    // compute expiry (extend if overlapping)
    const now = new Date();
    const currentExpiry = user.plan?.expiresAt ? new Date(user.plan.expiresAt) : null;
    const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
    const expiresAt = addDays(base, selected.durationDays);

    // activate plan + reset daily counters
    await users.updateOne(
      { telegramId: billRefNumber },
      {
        $set: {
          isPaid: true,
          updatedAt: new Date(),
          plan: {
            code: selected.code,
            label: selected.label,
            amount: selected.amount,
            hoursPerDay: selected.hoursPerDay,
            subjectsPerDay: selected.subjectsPerDay,
            expiresAt
          },
          "daily.date": new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(now),
          "daily.minutesUsed": 0,
          "daily.subjectsDone": 0
        }
      },
      { upsert: true }
    );

    // record payment (additive snapshot for audits)
    await payments.insertOne({
      transID,
      billRefNumber,
      amount,
      matched: true,
      channel: "mpesa_c2b",
      planCode: selected.code,
      hoursPerDay: selected.hoursPerDay,
      subjectsPerDay: selected.subjectsPerDay,
      durationDays: selected.durationDays,
      planSnapshot: { ...selected }, // snapshot at time of purchase
      msisdn,
      firstName,
      lastName,
      ip,
      userAgent,
      ts: new Date(),
      raw: body
    });

    // notify user
    await sendTelegramMessage(
      billRefNumber,
      [
        `✅ *Payment Received – KES ${amount}*`,
        `Plan: *${selected.label}*`,
        ``,
        `Today you can study:`,
        `• ⏱️ *${selected.hoursPerDay} hours/day*`,
        `• 📚 *${selected.subjectsPerDay} subjects/day*`,
        `• 🗓️ Expires: *${expiresAt.toDateString()}*`,
        ``,
        `Start now: type */study*`
      ].join("\n")
    );
  } catch (err: any) {
    const adminId = process.env.TG_ADMIN_ID || "7959124324";
    await sendTelegramMessage(adminId, `🔥 ERROR inside C2B handler:\n${err?.message || err}`);
  }
});
