import { Context } from "telegraf";
import { connectDB } from "./db";
import { ObjectId, WithId } from "mongodb";

/** ─────────── Paid plans (catalog) ─────────── */
export type PlanCode = "lite" | "steady" | "serious" | "club84" | "founder";
export type Tier = "free" | "lite" | "pro" | "plus" | "ultra";

export interface Plan {
  code: PlanCode;
  label: string;
  amount: number; // KES
  days: number;
  hrsPerDay: number;
  subjectsPerDay: number;
  /** Which Tier this plan unlocks inside the bot runtime */
  mapsToTier: Tier;
}

export const Plans: Record<PlanCode, Plan> = {
  lite:    { code: "lite",    label: "Lite Pass",      amount: 69,   days: 1,  hrsPerDay: 2, subjectsPerDay: 2, mapsToTier: "lite" },
  steady:  { code: "steady",  label: "Steady Pass",    amount: 499,  days: 7,  hrsPerDay: 2, subjectsPerDay: 2, mapsToTier: "pro" },
  serious: { code: "serious", label: "Serious Prep",   amount: 2999, days: 30, hrsPerDay: 5, subjectsPerDay: 3, mapsToTier: "plus" },
  club84:  { code: "club84",  label: "Club 84",        amount: 5999, days: 30, hrsPerDay: 8, subjectsPerDay: 4, mapsToTier: "ultra" },
  founder: { code: "founder", label: "Founder’s Offer",amount: 1499, days: 30, hrsPerDay: 5, subjectsPerDay: 3, mapsToTier: "plus" },
};

/** Helpers to resolve a plan */
export function planFromCode(code?: string | null): Plan | undefined {
  if (!code) return undefined;
  const key = code.toLowerCase() as PlanCode;
  return Plans[key];
}
export function planFromAmount(amount: number | string): Plan | undefined {
  const n = Math.round(Number(amount));
  return Object.values(Plans).find((p) => p.amount === n);
}

/** ─────────── Runtime tiers & limits ───────────
 * Free = 2 subjects total (trial). No minutes.
 * Paid = hours/day + subjects/day.
 */
export const PLAN_LIMITS: Record<
  Tier,
  {
    hoursPerDay: number;
    subjectsPerDay: number;
    markingsPerDay: number;
    trialTotalSubjects?: number; // FREE: total credits across all days
    trialMaxDays?: number;       // FREE: optional validity window after first use
  }
> = {
  free:  { hoursPerDay: 0, subjectsPerDay: 2, markingsPerDay: 1, trialTotalSubjects: 2, trialMaxDays: 7 },
  lite:  { hoursPerDay: 2, subjectsPerDay: 2, markingsPerDay: 2 },
  pro:   { hoursPerDay: 2, subjectsPerDay: 2, markingsPerDay: 4 },
  plus:  { hoursPerDay: 5, subjectsPerDay: 3, markingsPerDay: 6 },
  ultra: { hoursPerDay: 8, subjectsPerDay: 4, markingsPerDay: 10 },
};

export function minutesPerSession(tier: Tier) {
  switch (tier) {
    case "plus":  return 100; // ~5h/day ÷ 3
    case "ultra": return 120; // 8h/day ÷ 4
    default:      return 60;  // lite/pro
  }
}

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Decide the effective Tier from a stored user plan (ignores expired) */
function resolveTierFromUserPlan(userPlan: any): Tier | undefined {
  if (!userPlan) return undefined;
  if (userPlan.expiresAt && new Date(userPlan.expiresAt).getTime() < Date.now()) return undefined;
  if (userPlan.tier) return userPlan.tier as Tier;
  if (userPlan.code) return planFromCode(userPlan.code)?.mapsToTier as Tier | undefined;
  return undefined;
}

/** ─────────── Tier + usage storage ─────────── */
export async function getUserTier(ctx: Context): Promise<Tier> {
  const telegramId = ctx.from?.id?.toString()!;
  const db = await connectDB();
  const u = await db.collection("users").findOne({ telegramId }, { projection: { plan: 1 } });
  const resolved = resolveTierFromUserPlan(u?.plan);
  return resolved || "lite"; // ✅ keep previous baseline for non-payers
}

/** Has an active (non-free) plan by Telegram ID */
export async function hasActivePlanByTelegramId(telegramId: string): Promise<boolean> {
  const db = await connectDB();
  const u = await db.collection("users").findOne({ telegramId }, { projection: { plan: 1 } });
  const tier = resolveTierFromUserPlan(u?.plan);
  return !!tier && tier !== "free";
}

/** Context-based convenience */
export async function hasActivePlan(ctx: Context): Promise<boolean> {
  const telegramId = ctx.from?.id?.toString();
  if (!telegramId) return false;
  return hasActivePlanByTelegramId(telegramId);
}

type DailyDoc = {
  _id?: ObjectId;
  telegramId: string;
  date: string;          // YYYY-MM-DD
  minutesUsed: number;
  subjectsUsed: number;
  subjectsSet: string[]; // distinct subject slugs today
  markingsUsed: number;
  createdAt: Date;
  updatedAt: Date;
};

async function getDailyDoc(telegramId: string, date = todayKey()) {
  const db = await connectDB();
  const coll = db.collection<DailyDoc>("daily_counters");

  let doc: WithId<DailyDoc> | null = await coll.findOne({ telegramId, date });
  if (!doc) {
    const toInsert: DailyDoc = {
      telegramId,
      date,
      minutesUsed: 0,
      subjectsUsed: 0,
      subjectsSet: [],
      markingsUsed: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const res = await coll.insertOne(toInsert);
    doc = { ...toInsert, _id: res.insertedId };
  }
  return { coll, doc };
}

/** FREE: ensure we stamp first-use date for trial window */
async function ensureTrialStart(telegramId: string) {
  const db = await connectDB();
  const users = db.collection("users");
  const u = await users.findOne({ telegramId }, { projection: { trial: 1 } });
  if (!u?.trial?.startedAt) {
    const now = new Date();
    await users.updateOne(
      { telegramId },
      { $set: { trial: { startedAt: now } } },
      { upsert: true }
    );
    return now;
  }
  return new Date(u.trial.startedAt);
}

/** FREE: sum of subjects used across all days */
export async function getTotalSubjectsUsed(telegramId: string) {
  const db = await connectDB();
  const coll = db.collection<DailyDoc>("daily_counters");
  const agg = await coll
    .aggregate<{ total: number }>([
      { $match: { telegramId } },
      { $group: { _id: null, total: { $sum: "$subjectsUsed" } } },
      { $project: { _id: 0, total: 1 } },
    ])
    .toArray();
  return agg[0]?.total ?? 0;
}

/** What’s left for today (or global for free tier sessions) */
export async function getRemainingForToday(ctx: Context) {
  const telegramId = ctx.from?.id?.toString()!;
  const tier = await getUserTier(ctx);
  const limits = PLAN_LIMITS[tier];
  const { coll, doc } = await getDailyDoc(telegramId);

  // Paid tiers: minutes/day + subjects/day budgeting
  if (tier !== "free") {
    const minutesBudget = limits.hoursPerDay * 60;
    const minutesLeft = Math.max(0, minutesBudget - doc.minutesUsed);
    const subjectsLeftToday = Math.max(0, limits.subjectsPerDay - doc.subjectsUsed);
    return { tier, limits, coll, doc, minutesLeft, subjectsLeft: subjectsLeftToday };
  }

  // Free tier: subjects-based trial (2 total)
  await ensureTrialStart(telegramId);

  // Optional: block if outside trial window
  if (limits.trialMaxDays) {
    const db = await connectDB();
    const u = await db.collection("users").findOne({ telegramId }, { projection: { trial: 1 } });
    const startedAt = u?.trial?.startedAt ? new Date(u.trial.startedAt) : new Date();
    const expiry = new Date(startedAt.getTime() + limits.trialMaxDays * 24 * 60 * 60 * 1000);
    if (Date.now() > expiry.getTime()) {
      return { tier, limits, coll, doc, minutesLeft: 0, subjectsLeft: 0 };
    }
  }

  const usedTotalSubjects = await getTotalSubjectsUsed(telegramId);
  const trialSubjectsLeft = Math.max(0, (limits.trialTotalSubjects ?? 0) - usedTotalSubjects);

  const subjectsLeftToday = Math.max(0, limits.subjectsPerDay - doc.subjectsUsed);
  const subjectsLeft = Math.min(subjectsLeftToday, trialSubjectsLeft);

  return { tier, limits, coll, doc, minutesLeft: 0, subjectsLeft };
}

/** Reserve a session (subject credit for free; time+subject for paid) */
export async function reserveSession(ctx: Context, slug: string, minutes: number) {
  const telegramId = ctx.from?.id?.toString()!;
  const date = todayKey();
  const { tier, limits, coll, doc } = await getRemainingForToday(ctx);

  const willCountSubject = !doc.subjectsSet.includes(slug);
  const newSubjectsUsed = doc.subjectsUsed + (willCountSubject ? 1 : 0);
  const newSubjectsSet = willCountSubject ? [...doc.subjectsSet, slug] : doc.subjectsSet;

  if (tier === "free" && limits.trialTotalSubjects) {
    const usedTotalSubjects = await getTotalSubjectsUsed(telegramId);
    const trialSubjectsLeft = limits.trialTotalSubjects - usedTotalSubjects;
    if (trialSubjectsLeft <= 0) return { ok: false as const, reason: "trial_exhausted" };
    if (willCountSubject && newSubjectsUsed > limits.subjectsPerDay) {
      return { ok: false as const, reason: "subjects" };
    }
    await coll.updateOne(
      { telegramId, date },
      { $set: { updatedAt: new Date(), subjectsSet: newSubjectsSet, subjectsUsed: newSubjectsUsed } }
    );
    return { ok: true as const, tier, minutes: 0 };
  }

  // Paid tiers: enforce minutes/day + subjects/day
  const minutesBudget = limits.hoursPerDay * 60;
  if (doc.minutesUsed + minutes > minutesBudget) {
    return { ok: false as const, reason: "minutes" };
  }
  if (newSubjectsUsed > limits.subjectsPerDay) {
    return { ok: false as const, reason: "subjects" };
  }

  await coll.updateOne(
    { telegramId, date },
    {
      $set: { updatedAt: new Date(), subjectsSet: newSubjectsSet, subjectsUsed: newSubjectsUsed },
      $inc: { minutesUsed: minutes },
    }
  );

  return { ok: true as const, tier, minutes };
}
