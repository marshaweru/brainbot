import type { Db } from "mongodb";

async function tryIndex(col: ReturnType<Db["collection"]>, keys: Record<string, any>, opts: Record<string, any>) {
  try { await col.createIndex(keys, opts); }
  catch (e: any) {
    if (e?.codeName === "IndexOptionsConflict" || e?.codeName === "IndexKeySpecsConflict" || e?.code === 85 || e?.code === 86) {
      console.warn(`⚠️  Skipped conflicting index on ${col.collectionName}: ${opts.name}`); return;
    }
    throw e;
  }
}

export async function ensureWebIndexes(db: Db) {
  await tryIndex(db.collection("user_links"), { wid: 1 }, { unique: true, name: "user_links_wid_u" });
  await tryIndex(db.collection("user_links"), { telegramId: 1 }, { sparse: true, name: "user_links_tg_u" });
}
