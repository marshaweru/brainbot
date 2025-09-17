// apps/bot/src/repo/sessionRepo.ts
import { SessionModel, SessionDoc } from "../models/Session.js";
import type { UserSession as StateUserSession } from "../session/state.js"; // <- use state's type

/** ---- Persistent (Mongo) lean shape ---- */
export type LeanSession = Pick<
  SessionDoc,
  | "telegramId" | "active" | "mode" | "subjectIndex" | "subjectLabel" | "paper"
  | "startedAt" | "finishedAt" | "examPreset" | "examEndsAt" | "uploadEndsAt" | "expiresAt"
>;

// re-export the state UserSession type so callers refer to ONE type
export type UserSession = StateUserSession;

const TTL_HOURS = Math.max(1, Number(process.env.SESSION_TTL_HOURS ?? 3));
function computeExpiry(): Date { return new Date(Date.now() + TTL_HOURS * 3600 * 1000); }

/** Create new active persistent session and retire any active one. */
export async function createSession(params: {
  telegramId: string; subjectIndex?: number; subjectLabel?: string; paper?: 1 | 2 | 3;
}) {
  const { telegramId, subjectIndex, subjectLabel, paper } = params;
  await SessionModel.updateMany({ telegramId, active: true, expiresAt: { $gt: new Date() } }, { $set: { active: false } });
  const doc = await SessionModel.create({
    telegramId, active: true, mode: "in-progress",
    subjectIndex: subjectIndex ?? null, subjectLabel: subjectLabel ?? null, paper: paper ?? null,
    startedAt: new Date(), expiresAt: computeExpiry(),
  });
  return doc.toObject() as LeanSession;
}

export async function getActiveByTelegramId(tgId: string): Promise<LeanSession | null> {
  return SessionModel.findOne({ telegramId: tgId, active: true, expiresAt: { $gt: new Date() } })
    .lean<LeanSession | null>();
}

export async function sessionAddUpload(telegramId: string | number, upload: any) {
  const tid = String(telegramId);
  const active = await SessionModel.findOne({ telegramId: tid, active: true, expiresAt: { $gt: new Date() } });
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
