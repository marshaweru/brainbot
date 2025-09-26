import { MongoClient, Db } from "mongodb";

let _client: MongoClient | null = null;
let _db: Db | null = null;
let _connecting: Promise<MongoClient> | null = null;

async function getClient(uri: string): Promise<MongoClient> {
  if (_client) return _client;
  if (_connecting) return _connecting;
  const client = new MongoClient(uri);
  _connecting = client.connect().then(c => { _client = c; _connecting = null; return c; });
  return _connecting;
}

export async function connectMongo(uri: string, dbName: string): Promise<Db> {
  if (_db) return _db;
  const c = await getClient(uri);
  _db = c.db(dbName);
  return _db;
}

export function getDb(): Db {
  if (!_db) throw new Error("Mongo not connected. Call connectMongo() first.");
  return _db;
}

export async function getDbAsync(): Promise<Db> {
  if (_db) return _db;
  const uri = process.env.MONGODB_URI!;
  const dbName = process.env.MONGODB_DB || "brainbot";
  if (!uri) throw new Error("MONGODB_URI missing");
  return connectMongo(uri, dbName);
}

export async function closeMongo(): Promise<void> {
  if (_client) { await _client.close(); _client = null; _db = null; }
}
