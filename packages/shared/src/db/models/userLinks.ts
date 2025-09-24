import type { Db, Collection } from "mongodb";

export type UserLink = {
  wid: string;
  telegramId?: number;
  starts?: number;
  lastStartAt?: Date;
  ua?: string;
  ip?: string;
  planHint?: string;
  linkedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

export function userLinks(db: Db): Collection<UserLink> {
  return db.collection<UserLink>("user_links");
}

export async function ensureUserLinksIndexes(db: Db) {
  const col = userLinks(db);
  await col.createIndex({ wid: 1 }, { unique: true });
  await col.createIndex({ telegramId: 1 }, { sparse: true });
}
