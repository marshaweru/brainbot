import type { Collection, Db } from "mongodb";
import type { WithId } from "mongodb";

export type UserLink = {
  wid: string;                     // anonymous web id
  telegramId?: number;             // bound on first /start from Telegram
  starts?: number;                 // times user clicked "Start" on web
  lastStartAt?: Date;
  ua?: string;
  ip?: string;
  planHint?: string;               // last plan seen in payload
  linkedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

export function userLinks(db: Db): Collection<UserLink> {
  return db.collection<UserLink>("user_links");
}

// ensure wid index (unique) and telegramId index (sparse)
export async function ensureUserLinksIndexes(db: Db) {
  const col = userLinks(db);
  await col.createIndex({ wid: 1 }, { unique: true });
  await col.createIndex({ telegramId: 1 }, { sparse: true });
}
