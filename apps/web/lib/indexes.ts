// apps/web/lib/indexes.ts
import { Db } from "mongodb";

export async function ensureWebIndexes(db: Db) {
  // link_tokens: expire automatically when expiresAt < now
  await db.collection("link_tokens").createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: "link_tokens_expiry" }
  );

  // link_tokens: jti uniqueness (so a token can't be reused)
  await db.collection("link_tokens").createIndex(
    { jti: 1 },
    { unique: true, name: "link_tokens_jti_unique" }
  );

  // user_links: wid ↔ telegramId should be unique combo
  await db.collection("user_links").createIndex(
    { wid: 1 },
    { unique: true, name: "user_links_wid_unique" }
  );
  await db.collection("user_links").createIndex(
    { telegramId: 1 },
    { unique: true, sparse: true, name: "user_links_tid_unique" }
  );
}
