// apps/bot/src/repo/sessionRepo.ts
import { connectMongo } from "../db/mongo";
import { SessionModel, type SessionDoc } from "../models/Session";
import type { UserSession } from "../session/state";

export async function upsertSession(s: UserSession): Promise<void> {
  await connectMongo();
  await SessionModel.updateOne(
    { telegramId: s.telegramId },
    {
      $set: {
        mode: s.mode,
        subjectIndex: s.subjectIndex,
        subjectLabel: s.subjectLabel,
        startedAt: s.startedAt,
        uploads: s.uploads ?? [],
      },
    },
    { upsert: true }
  );
}

export async function getSessionByTelegramId(telegramId: string): Promise<UserSession | null> {
  await connectMongo();
  const doc = await SessionModel.findOne({ telegramId }).lean<SessionDoc>().exec();
  if (!doc) return null;
  return {
    telegramId: doc.telegramId,
    mode: (doc.mode as any) ?? null,
    subjectIndex: doc.subjectIndex ?? undefined,
    subjectLabel: doc.subjectLabel ?? undefined,
    startedAt: doc.startedAt ?? undefined,
    uploads: (doc.uploads as any[]) ?? [],
  };
}

export async function clearSessionByTelegramId(telegramId: string): Promise<void> {
  await connectMongo();
  await SessionModel.deleteOne({ telegramId }).exec();
}
