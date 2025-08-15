import { MongoClient, Db } from 'mongodb';
const uri = process.env.MONGODB_URI as string;
if (!uri) throw new Error('❌ MONGODB_URI not set');
let client: MongoClient | null = null; let _db: Db | null = null;
export async function connectDB(): Promise<Db> {
  if (_db) return _db; client = new MongoClient(uri); await client.connect(); _db = client.db(); console.log('🧠 Mongo connected'); return _db;
}
export async function getCollections() {
  const db = await connectDB();
  return { users: db.collection('users'), payments: db.collection('payments'),
           settings: db.collection('settings'), usage: db.collection('usage_logs') };
}
export async function getUserSession(telegramId: string) {
  const { users } = await getCollections(); return users.findOne({ telegramId });
}
