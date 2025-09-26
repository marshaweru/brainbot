// apps/bot/src/repo/sessionRepo.ts
import { SessionModel, SessionDoc } from "../models/Session.js";
import type { UserSession as StateUserSession } from "../session/state.js";
import type { PlanTier } from "./planRepo.js";

/** ---- Persistent (Mongo) lean shape ---- */
export type LeanSession = Pick<
  SessionDoc,
  | "telegramId"
  | "active"
  | "mode"
  | "subjectIndex"
  | "subjectLabel"
  | "paper"
  | "startedAt"
  | "finishedAt"
  | "examPreset"
  | "examEndsAt"
  | "uploadEndsAt"
  | "expiresAt"
>;

// re-export the state UserSession type so callers refer to ONE type
export type UserSession = StateUserSession;

/* ========= Session timing policy =========
   Env overrides keep us flexible without code changes.
   Defaults reflect the product decision you just made.
*/
const FALLBACK_TTL_HOURS = Math.max(1, Number(process.env.SESSION_TTL_HOURS ?? 3));

const LITE_HOURS = Number(process.env.LITE_SESSION_HOURS ?? 4);
const STEADY_HOURS = Number(process.env.STEADY_SESSION_HOURS ?? 4);
const LIMITED_HOURS = Number(process.env.LIMITED_SESSION_HOURS ?? 6);
const SERIOUS_HOURS = Number(process.env.SERIOUS_SESSION_HOURS ?? 6);
const ELITE_HOURS = Number(process.env.ELITE_SESSION_HOURS ?? 24);

type ExamPreset = "2h" | "2h30";

/** Normalize any legacy/input value to our enum */
export function normalizeExamPreset(v: string | number | null | undefined): ExamPreset {
  const s = String(v ?? "2").trim().toLowerCase().replace(/\s+/g, "");
  if (s === "2.5" || s === "2h30" || s === "150" || s === "150m" || s === "2.5h" || s === "2hr30min") {
    return "2h30";
  }
  return "2h";
}

export function presetToHours(p: ExamPreset): number {
  return p === "2h30" ? 2.5 : 2;
}

/** Compute the total allowed session window (in hours) based on tier & paper length. */
function computeSessionHours(tier?: PlanTier, paperHours?: number): number {
  // If we don’t know tier or paperHours, fall back to legacy TTL
  if (!tier || paperHours == null || Number.isNaN(paperHours)) return FALLBACK_TTL_HOURS;

  const ph = Math.max(0.5, Number(paperHours)); // sanity floor: 30 mins min paper
  switch (tier) {
    case "free":
      // Free: 1h upload/marking buffer, capped at 3.5h
      return Math.min(ph + 1, 3.5);
    case "lite":
      return LITE_HOURS;
    case "steady":
      return STEADY_HOURS;
    case "limited":
      return LIMITED_HOURS;
    case "serious":
      return SERIOUS_HOURS;
    case "elite":
      return ELITE_HOURS;
    default:
      return FALLBACK_TTL_HOURS;
  }
}

/** Helper to compute absolute expiry timestamps given tier & paper length */
function computeExpiryWindows(tier?: PlanTier, paperHours?: number) {
  const now = Date.now();
  const totalHours = computeSessionHours(tier, paperHours);
  const totalMs = totalHours * 3600 * 1000;

  // Exam timer ends at paperHours (if known), upload window lasts the rest.
  const hasPaper = paperHours != null && Number.isFinite(paperHours);
  const examMs = hasPaper ? Math.max(0, Number(paperHours) * 3600 * 1000) : 0;

  const startedAt = new Date(now);
  const examEndsAt = hasPaper ? new Date(now + examMs) : null;
  const uploadEndsAt = new Date(now + totalMs);
  const expiresAt = uploadEndsAt; // persist the governing TTL as expiresAt

  return { startedAt, examEndsAt, uploadEndsAt, expiresAt };
}

/** Create new active persistent session and retire any active one. */
export async function createSession(params: {
  telegramId: string;
  subjectIndex?: number;
  subjectLabel?: string;
  paper?: 1 | 2 | 3;
  /** Plan tier at the moment of session start (affects timers) */
  tier?: PlanTier;
  /** Paper duration in hours, e.g., 2 or 2.5 (derived from examPreset) */
  paperHours?: number;
  /** Normalized preset to satisfy schema enum */
  examPreset: ExamPreset;
}) {
  const { telegramId, subjectIndex, subjectLabel, paper, tier, paperHours, examPreset } = params;

  // Retire any active shell/row
  await SessionModel.updateMany(
    { telegramId, active: true, expiresAt: { $gt: new Date() } },
    { $set: { active: false } }
  );

  const { startedAt, examEndsAt, uploadEndsAt, expiresAt } = computeExpiryWindows(tier, paperHours);

  const doc = await SessionModel.create({
    telegramId,
    active: true,
    mode: "in-progress",
    subjectIndex: subjectIndex ?? null,
    subjectLabel: subjectLabel ?? null,
    paper: paper ?? null,

    startedAt,
    // ✅ store the enum string the schema expects
    examPreset,
    examEndsAt,
    uploadEndsAt,
    expiresAt,

    uploads: [],
  });

  return doc.toObject() as LeanSession;
}

export async function getActiveByTelegramId(tgId: string): Promise<LeanSession | null> {
  return SessionModel.findOne({
    telegramId: tgId,
    active: true,
    expiresAt: { $gt: new Date() },
  }).lean<LeanSession | null>();
}

export async function sessionAddUpload(telegramId: string | number, upload: any) {
  const tid = String(telegramId);
  const active = await SessionModel.findOne({
    telegramId: tid,
    active: true,
    expiresAt: { $gt: new Date() },
  });
  if (!active) throw new Error("No active session to attach upload.");
  const enriched = { ...upload, sessionId: String(active._id) };
  await SessionModel.updateOne({ _id: active._id }, { $push: { uploads: enriched } });
  return enriched;
}

export async function listUploadsBySession(sessionId: string) {
  const doc = await SessionModel.findById(sessionId).lean<SessionDoc | null>();
  if (!doc) throw new Error(`Session not found: ${sessionId}`);
  return doc.uploads ?? [];
}

export async function finishActive(tgId: string): Promise<LeanSession | null> {
  return SessionModel.findOneAndUpdate(
    { telegramId: tgId, active: true, expiresAt: { $gt: new Date() } },
    { $set: { active: false, finishedAt: new Date(), mode: "finished" } },
    { new: true }
  ).lean<LeanSession | null>();
}

/* ---------------- Ephemeral in-memory session (used by state.ts) ---------------- */

const MEM = new Map<string, UserSession>();

export async function getSessionByTelegramId(telegramId: string | number): Promise<UserSession | null> {
  return MEM.get(String(telegramId)) ?? null;
}
export async function clearSessionByTelegramId(telegramId: string | number): Promise<void> {
  MEM.delete(String(telegramId));
}

/** Overloads: (sessionObj) OR (telegramId, patch) — both return UserSession */
export async function upsertSession(session: UserSession): Promise<UserSession>;
export async function upsertSession(
  telegramId: string | number,
  patch: Record<string, unknown>
): Promise<UserSession>;
export async function upsertSession(a: any, b?: any): Promise<UserSession> {
  // normalize into { telegramId, ...patch }
  let key: string;
  let patch: Partial<UserSession>;
  if (typeof a === "object" && a !== null && b === undefined) {
    key = String(a.telegramId);
    patch = a as Partial<UserSession>;
  } else {
    key = String(a);
    patch = (b ?? {}) as Partial<UserSession>;
  }

  // Avoid nulls for strict fields like mode; undefined is safer
  if ((patch as any)?.mode === null) delete (patch as any).mode;

  const prev = MEM.get(key) ?? ({ telegramId: key } as UserSession);
  const next = { ...prev, ...patch } as UserSession;
  MEM.set(key, next);
  return next;
}
