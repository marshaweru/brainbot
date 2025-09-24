import { MongoClient, Db } from "mongodb";

let _client: MongoClient | null = null;
let _db: Db | null = null;
let _connecting: Promise<MongoClient> | null = null;

/**
 * Ensure we have a single MongoClient per process.
 */
async function getClient(uri: string): Promise<MongoClient> {
  if (_client) return _client;
  if (_connecting) return _connecting;

  const client = new MongoClient(uri);
  _connecting = client.connect().then((c) => {
    _client = c;
    _connecting = null;
    return c;
  });
  return _connecting;
}

/**
 * Get the active DB instance, connecting once if needed.
 */
export async function getDb(): Promise<Db> {
  if (_db) return _db;

  const uri = process.env.MONGODB_URI!;
  const dbName = process.env.MONGODB_DB || "brainbot";
  if (!uri) throw new Error("MONGODB_URI missing");

  const client = await getClient(uri);
  _db = client.db(dbName);
  return _db;
}
