// apps/bot/src/session/state.ts
import { upsertSession, getSessionByTelegramId, clearSessionByTelegramId } from "../repo/sessionRepo.js";

export type UploadKind = "photo" | "voice" | "document" | "text";
export type Upload =
  | { kind: "text"; text: string }
  | { kind: "photo"; fileId: string; caption?: string }
  | { kind: "document"; fileId: string; mimeType?: string; caption?: string }
  | { kind: "voice"; fileId: string; duration?: number };

export type SessionMode = "awaiting-subject" | "in-progress" | null;

export type UserSession = {
  mode: SessionMode;
  telegramId: string;
  subjectIndex?: number;
  subjectLabel?: string;
  startedAt?: number; // epoch ms
  uploads: Upload[];
};

const SESSIONS = new Map<string, UserSession>();

const mongoEnabled = !!process.env.MONGODB_URI;

function ensure(uid: string): UserSession {
  if (!SESSIONS.has(uid)) {
    SESSIONS.set(uid, { mode: null, telegramId: uid, uploads: [] });
  }
  return SESSIONS.get(uid)!;
}

export async function loadSession(uid: string): Promise<UserSession> {
  const local = ensure(uid);
  if (!mongoEnabled) return local;

  // pull latest from DB if present (first time in memory)
  if (local.mode === null) {
    const db = await getSessionByTelegramId(uid);
    if (db) {
      SESSIONS.set(uid, db);
      return db;
    }
  }
  return local;
}

export async function setSession(uid: string, patch: Partial<UserSession>) {
  const cur = ensure(uid);
  const next: UserSession = { ...cur, ...patch, telegramId: uid, uploads: patch.uploads ?? cur.uploads ?? [] };
  SESSIONS.set(uid, next);
  if (mongoEnabled) await upsertSession(next);
}

export async function addUpload(uid: string, u: Upload) {
  const cur = ensure(uid);
  const next = { ...cur, uploads: [...(cur.uploads ?? []), u] };
  SESSIONS.set(uid, next);
  if (mongoEnabled) await upsertSession(next);
}

export async function clearSession(uid: string) {
  SESSIONS.set(uid, { mode: null, telegramId: uid, uploads: [] });
  if (mongoEnabled) await clearSessionByTelegramId(uid);
}
