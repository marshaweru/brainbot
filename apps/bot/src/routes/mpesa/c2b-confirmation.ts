import express, { Request, Response } from 'express';
import { getCollections, getUserSession } from '../../lib/db';
import { Plans } from '@brainbot/shared/src/plans';
import { addDays } from '@brainbot/shared/src/utils';
import { sendTelegramMessage } from '../../lib/telegram';

export const router = express.Router();

function normalizeAmount(a: any) { const n = Number(a); if (Number.isNaN(n)) return NaN; return Math.round(n); }
function getPlanByAmount(amountKes: number) {
  return Object.entries(Plans).map(([code, p]) => ({ code, ...p as any })).find((p: any) => p.amount === amountKes);
}

router.post('/', async (req: Request, res: Response) => {
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  try {
    const body = req.body;
    const billRefNumber = String(body?.BillRefNumber || body?.billRefNumber || '').trim();
    const amount = normalizeAmount(body?.TransAmount || body?.amount);
    const transID = String(body?.TransID || body?.transactionId || '').trim();
    const TG_ADMIN_ID = process.env.TG_ADMIN_ID || '7959124324';
    await sendTelegramMessage(TG_ADMIN_ID, `🚨 *C2B Payment*\n${JSON.stringify({ billRefNumber, amount, transID }, null, 2)}`);

    if (!billRefNumber || !amount || Number.isNaN(amount)) return;

    const { users, payments, settings } = await getCollections();
    const existing = await payments.findOne({ transID }); if (existing) return;

    let selected: any = getPlanByAmount(amount);
    if (!selected) {
      await payments.insertOne({ transID, billRefNumber, amount, matched: false, ts: new Date(), raw: body });
      await sendTelegramMessage(billRefNumber, `⚠️ Payment (KES ${amount}) didn’t match a BrainBot plan.`);
      return;
    }

    if (selected.code === 'FIRST100') {
      const gate = await settings.findOneAndUpdate({ key: 'first100-counter' }, { $inc: { count: 1 } }, { upsert: true, returnDocument: 'after' });
      const count = gate.value?.count || 0;
      if (count > 100) {
        await sendTelegramMessage(billRefNumber, `⏳ KES 1,500 founder deal sold out. Crediting **Plus (Month)** instead.`);
        selected = { code: 'PLUS_MONTH', ...Plans.PLUS_MONTH } as any;
      }
    }

    let user = await getUserSession(billRefNumber);
    if (!user) {
      await users.insertOne({ telegramId: billRefNumber, createdAt: new Date(), updatedAt: new Date(),
        isPaid: false, plan: null, daily: { date: null, minutesUsed: 0, subjectsDone: 0 },
        referral: { referrerId: null, paidReferrals: 0, hasPaid: false }, });
      user = await users.findOne({ telegramId: billRefNumber });
    }

    const now = new Date();
    const currentExpiry = user?.plan?.expiresAt ? new Date(user.plan.expiresAt) : null;
    const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
    const expiresAt = addDays(base, selected.durationDays);

    await users.updateOne(
      { telegramId: billRefNumber },
      { $set: { isPaid: true, updatedAt: new Date(),
        plan: { code: selected.code, label: selected.label, amount: selected.amount,
                hoursPerDay: selected.hoursPerDay, subjectsPerDay: selected.subjectsPerDay, expiresAt, },
        'daily.date': new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(now),
        'daily.minutesUsed': 0, 'daily.subjectsDone': 0, } },
      { upsert: true }
    );

    await payments.insertOne({ transID, billRefNumber, amount, matched: true, planCode: selected.code,
      hoursPerDay: selected.hoursPerDay, subjectsPerDay: selected.subjectsPerDay, durationDays: selected.durationDays,
      ts: new Date(), raw: body });

    await sendTelegramMessage(billRefNumber, [
      `✅ *Payment Received – KES ${amount}*`,
      `Plan: *${selected.label}*`,
      ``,
      `Today you can study:`,
      `• ⏱️ *${selected.hoursPerDay} hours/day*`,
      `• 📚 *${selected.subjectsPerDay} subjects/day*`,
      `• 🗓️ Expires: *${expiresAt.toDateString()}*`,
      ``,
      `Start now: type */study*`
    ].join('\n'));
  } catch (err: any) {
    const TG_ADMIN_ID = process.env.TG_ADMIN_ID || '7959124324';
    await sendTelegramMessage(TG_ADMIN_ID, `🔥 ERROR inside C2B handler:\n${err?.message || err}`);
  }
});
