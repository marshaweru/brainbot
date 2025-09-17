import { SessionModel, SessionDoc } from "../models/Session";

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

const TTL_HOURS = Math.max(1, Number(process.env.SESSION_TTL_HOURS ?? 3));
function computeExpiry(): Date {
  return new Date(Date.now() + TTL_HOURS * 3600 * 1000);
}

export async function createSession(params: {
  telegramId: string;
  subjectIndex?: number;
  subjectLabel?: string;
  paper?: 1 | 2 | 3;
}) {
  const { telegramId, subjectIndex, subjectLabel, paper } = params;

  await SessionModel.updateMany(
    { telegramId, active: true, expiresAt: { $gt: new Date() } },
    { $set: { active: false } }
  );

  const doc = await SessionModel.create({
    telegramId,
    active: true,
    mode: "in-progress",
    subjectIndex: subjectIndex ?? null,
    subjectLabel: subjectLabel ?? null,
    paper: paper ?? null,
    startedAt: new Date(),
    expiresAt: computeExpiry(),
  });

  return doc.toObject() as LeanSession;
}

export async function getActiveByTelegramId(
  tgId: string
): Promise<LeanSession | null> {
  return SessionModel.findOne({
    telegramId: tgId,
    active: true,
    expiresAt: { $gt: new Date() },
  }).lean<LeanSession | null>();
}

/**
 * Append an upload to the active session.
 * Saves both in the session doc and tags it with sessionId.
 */
export async function sessionAddUpload(
  telegramId: string | number,
  upload: any
) {
  const tid = String(telegramId);
  const active = await SessionModel.findOne({
    telegramId: tid,
    active: true,
    expiresAt: { $gt: new Date() },
  });

  if (!active) throw new Error("No active session to attach upload.");

  const enriched = { ...upload, sessionId: String(active._id) };

  await SessionModel.updateOne(
    { _id: active._id },
    { $push: { uploads: enriched } }
  );

  return enriched;
}

/**
 * List all uploads tied to a specific session.
 */
export async function listUploadsBySession(sessionId: string) {
  const doc = await SessionModel.findById(sessionId).lean<SessionDoc | null>();
  if (!doc) throw new Error(`Session not found: ${sessionId}`);
  return doc.uploads ?? [];
}

export async function finishActive(
  tgId: string
): Promise<LeanSession | null> {
  return SessionModel.findOneAndUpdate(
    { telegramId: tgId, active: true, expiresAt: { $gt: new Date() } },
    { $set: { active: false, finishedAt: new Date(), mode: "finished" } },
    { new: true }
  ).lean<LeanSession | null>();
}
