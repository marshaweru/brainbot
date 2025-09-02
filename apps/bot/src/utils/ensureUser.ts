// apps/bot/src/utils/ensureUser.ts
import { getCollections } from "../lib/db.js";

/** Make sure a users doc exists; swallow racey E11000 on first insert. */
export async function ensureUserExists(telegramId: string) {
  const { users } = await getCollections();
  try {
    await users.updateOne(
      { telegramId },
      {
        $setOnInsert: { telegramId, createdAt: new Date() },
        $set: { updatedAt: new Date() },
      },
      { upsert: true }
    );
  } catch (e: any) {
    // If two handlers upsert at the same time, one insert wins,
    // the other sees E11000. That's fine — the doc now exists.
    if (!/E11000 duplicate key/i.test(e?.message || "")) throw e;
  }
}

