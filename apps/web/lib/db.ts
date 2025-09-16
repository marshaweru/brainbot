// apps/web/lib/db.ts
import { MongoClient, Db } from "mongodb";
import { ensureWebIndexes } from "@brainbot/shared/db"; // ✅ now using shared package

const uri = process.env.MONGODB_URI!;
const dbName = process.env.MONGODB_DB ?? "brainbot";

let _client: MongoClient | null = null;
let _db: Db | null = null;
let _indexed = false;

export async function db() {
  if (_db) return _db;
  if (!_client) {
    _client = new MongoClient(uri);
    await _client.connect();
  }
  _db = _client.db(dbName);

  // ensure indexes once per process
  if (!_indexed) {
    try {
      await ensureWebIndexes(_db);
      _indexed = true;
      console.log("✅ Web indexes ensured (from shared)");
    } catch (e) {
      console.error("⚠️ ensureWebIndexes failed (continuing):", e);
    }
  }

  return _db;
}
