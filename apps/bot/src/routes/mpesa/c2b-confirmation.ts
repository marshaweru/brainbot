// apps/bot/src/routes/mpesa/c2b-confirmation.ts
import express, { type Request, type Response } from "express";
import { getCollections, getUserSession } from "../../lib/db.js";
import { Plans, planFromAmount } from "../../lib/plan.js";
import { sendTelegramMessage } from "../../lib/telegram.js";
       // ⬅️ .js

export const router = express.Router();
// …rest of file unchanged…

type PlanCode = keyof typeof Plans;
type SelectedPlan = ReturnType<typeof planFromAmount> & { code: PlanCode };

/** Add whole days to a date */
function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function normalizeAmount(a: any): number {
  // Accept: numbers, "2999", "2,999", "2999.00", "KES 2,999", etc.
  if (a == null) return NaN;
  const s = String(a).replace(/[^0-9.]/g, "");
  const n = Number(s);
  return Number.isNaN(n) ? NaN : Math.round(n);
}

function getPlanByAmount(amountKes: number): SelectedPlan | null {
  const p = planFromAmount(amountKes);
  if (!p) return null;

  // recover the code key (since Plans values include `code`, this cast is safe)
  const code = p.code as PlanCode;
  return { ...p, code };
}

router.post("/", async (req: Request, res: Response) => {
  // Acknowledge immediately so Safaricom doesn't retry
  res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

  try {
    const body = req.body || {};

    // Defensive key reads (upper/lower variants included)
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
    const adminId = process.env.TG_ADMIN_ID || process.env.ADMIN_TELEGRAM_ID || "";

    // Telemetry bits
    const ip = (req.headers["x-forwarded-for"]?.toString() || req.ip || "").split(",")[0].trim();
    const userAgent = req.headers["user-agent"] || "";

    // Notify admin (compact, no MarkdownV2 escaping headaches)
    if (adminId) {
      await sendTelegramMessage(
        adminId,
        [
          "🚨 C2B Payment",
          `billRefNumber: ${billRefNumber}`,
          `amount: ${amount}`,
          `transID: ${transID}`,
          `msisdn: ${msisdn}`,
          `name: ${firstName} ${lastName}`,
          `ip: ${ip}`,
        ].join("\n")
      );
    }

    if (!billRefNumber || !amount || Number.isNaN(amount)) return;

    const { users, payments, settings } = await getCollections();

    // Idempotency: skip if we’ve recorded this TransID already
    const existing = await payments.findOne({ transID });
    if (existing) return;

    // Plan matching by exact amount
    let selected = getPlanByAmount(amount);
    if (!selected) {
      await payments.insertOne({
        transID,
        billRefNumber,
        amount,
        matched: false,
        channel: "mpesa_c2b",
        ts: new Date(),
        ip,
        userAgent,
        raw: body,
      });
      await sendTelegramMessage(
        billRefNumber,
        `⚠️ Payment (KES ${amount}) didn’t match a BrainBot plan. Our team will review.`
      );
      return;
    }

    // Founder (first 100) gating
    if (selected.code === "founder") {
      const gate = await settings.findOneAndUpdate(
        { key: "founder-counter" },
        { $inc: { count: 1 } },
        { upsert: true, returnDocument: "after" }
      );
      const count = Number(gate?.value?.count ?? 0);
      if (count > 100) {
        await sendTelegramMessage(
          billRefNumber,
          `⏳ KES ${selected.amount} founder deal is sold out. Crediting *Serious Prep* instead.`
        );
        selected = { ...Plans.serious, code: "serious" };
      }
    }

    // Ensure user record (we treat billRefNumber as Telegram ID)
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
        autoCreatedFromPayment: true,
      });
      user = await users.findOne({ telegramId: billRefNumber });
    }
    if (!user) return;

    // Compute expiry (extend if overlapping)
    const now = new Date();
    const currentExpiry = user.plan?.expiresAt ? new Date(user.plan.expiresAt) : null;
    const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
    const expiresAt = addDays(base, selected.days);

    // Activate plan & reset today’s counters
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
            hoursPerDay: selected.hrsPerDay,          // normalized field name stored on user
            subjectsPerDay: selected.subjectsPerDay,
            expiresAt,
            tier: selected.mapsToTier,                // so getUserTier() resolves immediately
          },
          "daily.date": new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(now),
          "daily.minutesUsed": 0,
          "daily.subjectsDone": 0,
        },
      },
      { upsert: true }
    );

    // Record payment audit snapshot
    await payments.insertOne({
      transID,
      billRefNumber,
      amount,
      matched: true,
      channel: "mpesa_c2b",
      planCode: selected.code,
      hoursPerDay: selected.hrsPerDay,
      subjectsPerDay: selected.subjectsPerDay,
      durationDays: selected.days,
      planSnapshot: { ...selected },
      msisdn,
      firstName,
      lastName,
      ip,
      userAgent,
      ts: new Date(),
      raw: body,
    });

    // Tell the user
    await sendTelegramMessage(
      billRefNumber,
      [
        `✅ *Payment Received – KES ${selected.amount}*`,
        `Plan: *${selected.label}*`,
        ``,
        `Today you can study:`,
        `• ⏱️ *${selected.hrsPerDay} hours/day*`,
        `• 📚 *${selected.subjectsPerDay} subjects/day*`,
        `• 🗓️ Expires: *${expiresAt.toDateString()}*`,
        ``,
        `Start now: type */study*`,
      ].join("\n")
    );
  } catch (err: any) {
    const adminId = process.env.TG_ADMIN_ID || process.env.ADMIN_TELEGRAM_ID || "";
    if (adminId) {
      await sendTelegramMessage(adminId, `🔥 ERROR inside C2B handler:\n${err?.message || err}`);
    }
  }
});
