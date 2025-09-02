// apps/bot/src/lib/trialStore.ts
import { getCollections, safeUpdateOne } from "./db.js";
import type { TrialState } from "../utils/trial.js";
import { defaultTrial, normalizeTrial, claimTrial } from "../utils/trial.js";

export async function getTrialState(telegramId: string): Promise<TrialState> {
  const { users } = await getCollections();
  const u = await users.findOne(
    { telegramId },
    { projection: { trial: 1 } as any }
  );
  return normalizeTrial((u as any)?.trial ?? defaultTrial());
}

export async function saveTrialState(
  telegramId: string,
  state: TrialState
): Promise<void> {
  const { users } = await getCollections();
  await safeUpdateOne(
    users,
    { telegramId },
    {
      $set: { trial: state, updatedAt: new Date() },
      $setOnInsert: { telegramId, createdAt: new Date() },
    },
    { upsert: true }
  );
}

/** Atomically consume ONE trial session; safe under concurrent taps. */
export async function consumeTrialSessionAtomic(
  telegramId: string
): Promise<{ ok: boolean; state: TrialState }> {
  const { users } = await getCollections();

  // First attempt: create default trial if missing (upsert)
  try {
    await safeUpdateOne(
      users,
      {
        telegramId,
        $or: [
          { trial: { $exists: false } },
          { "trial.sessionsRemaining": { $exists: false } },
        ],
      },
      {
        $setOnInsert: { telegramId, createdAt: new Date() },
        $set: { trial: claimTrial(defaultTrial()), updatedAt: new Date() },
      },
      { upsert: true }
    );
  } catch (e: any) {
    if (!/E11000 duplicate key/i.test(String(e?.message || ""))) throw e;
  }

  // Decrement if > 0 (no upsert here)
  const res = await users.findOneAndUpdate(
    { telegramId, "trial.sessionsRemaining": { $gt: 0 } },
    { $inc: { "trial.sessionsRemaining": -1 }, $set: { updatedAt: new Date() } },
    { returnDocument: "after" }
  );

  const value = (res && (res as any).value) ?? null;
  if (!value) {
    const state = await getTrialState(telegramId);
    return { ok: false, state };
  }
  return { ok: true, state: normalizeTrial((value as any).trial) };
}
