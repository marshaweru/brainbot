// apps/bot/src/repo/sessionRepo.ts
import { connectMongo } from "../db/mongo";
import { SessionModel, type SessionDoc } from "../models/Session";

/** Uploads your bot accepts (matches index.ts) */
export type Upload =
  | { kind: "text"; text: string }
  | { kind: "photo"; fileId: string; caption?: string }
  | { kind: "document"; fileId: string; mimeType?: string; caption?: string }
  | { kind: "voice"; fileId: string; duration?: number };

/** Session state shape your bot uses */
export type SessionState = {
  mode: "awaiting-subject" | "in-progress" | null;
  subjectIndex?: number;
  subjectLabel?: string;
  startedAt?: number;  // epoch ms (we store Date in Mongo, convert here)
  uploads: Upload[];
};

const TTL_HOURS = Math.max(1, Number(process.env.SESSION_TTL_HOURS ?? 3));

function toState(doc?: SessionDoc | null): SessionState {
  if (!doc) return { mode: null, uploads: [] };
  return {
    mode: (doc.mode as any) ?? null,
    subjectIndex: doc.subjectIndex ?? undefined,
    subjectLabel: doc.subjectLabel ?? undefined,
    startedAt: doc.startedAt ? doc.startedAt.getTime() : undefined,
    uploads: (doc.uploads as any) ?? [],
  };
}

/** Read current active session (auto-connects to Mongo) */
export async function loadSession(telegramId: string): Promise<SessionState> {
  await connectMongo();
  const doc = await SessionModel.findOne({ telegramId, active: true }).lean();
  return toState(doc as any);
}

/** Create or patch the active session; extends TTL on every write */
export async function setSession(
  telegramId: string,
  patch: Partial<SessionState> & { mode?: "awaiting-subject" | "in-progress" | null }
): Promise<void> {
  await connectMongo();

  const $set: any = {
    active: true,
    expiresAt: new Date(Date.now() + TTL_HOURS * 3600 * 1000),
    updatedAt: new Date(),
  };

  if (patch.mode != null) $set.mode = patch.mode;
  if (patch.subjectIndex != null) $set.subjectIndex = patch.subjectIndex;
  if (patch.subjectLabel != null) $set.subjectLabel = patch.subjectLabel;
  if (patch.startedAt != null) $set.startedAt = new Date(patch.startedAt);
  if (patch.uploads != null) $set.uploads = patch.uploads;

  await SessionModel.findOneAndUpdate(
    { telegramId, active: true },
    {
      $setOnInsert: {
        telegramId,
        active: true,
        startedAt: new Date(),
      },
      $set,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/** Push a single upload into the active session; creates one if missing */
export async function addUpload(telegramId: string, upload: Upload): Promise<void> {
  await connectMongo();
  await SessionModel.findOneAndUpdate(
    { telegramId, active: true },
    {
      $setOnInsert: {
        telegramId,
        active: true,
        mode: "in-progress",
        startedAt: new Date(),
      },
      $push: { uploads: upload as any },
      $set: { expiresAt: new Date(Date.now() + TTL_HOURS * 3600 * 1000) },
    },
    { upsert: true }
  );
}

/** Mark the session inactive & let TTL clean it up */
export async function clearSession(telegramId: string): Promise<void> {
  await connectMongo();
  await SessionModel.updateOne(
    { telegramId, active: true },
    { $set: { active: false, expiresAt: new Date(), updatedAt: new Date() } }
  );
}
