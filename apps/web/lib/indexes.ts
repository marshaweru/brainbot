import { Db } from "mongodb";

/**
 * Ensures core web indexes exist (idempotent).
 */
export async function ensureWebIndexes(db: Db) {
  const created: string[] = [];

  const linkTokens = db.collection("link_tokens");
  await linkTokens.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: "link_tokens_expiry", background: true }
  );
  created.push("link_tokens_expiry");

  await linkTokens.createIndex(
    { jti: 1 },
    { unique: true, name: "link_tokens_jti_unique", background: true }
  );
  created.push("link_tokens_jti_unique");

  const userLinks = db.collection("user_links");
  await userLinks.createIndex(
    { wid: 1 },
    { unique: true, name: "user_links_wid_unique", background: true }
  );
  created.push("user_links_wid_unique");

  await userLinks.createIndex(
    { telegramId: 1 },
    {
      unique: true,
      sparse: true,
      name: "user_links_tid_unique",
      background: true,
    }
  );
  created.push("user_links_tid_unique");

  return { created };
}
