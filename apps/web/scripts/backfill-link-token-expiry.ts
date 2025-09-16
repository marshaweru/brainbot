import "dotenv/config";
import { MongoClient } from "mongodb";

async function main() {
  const uri = process.env.MONGODB_URI!;
  const dbName = process.env.MONGODB_DB ?? "brainbot";
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const col = db.collection("link_tokens");

  const cursor = col.find({ expiresAt: { $exists: false }, exp: { $type: "number" } });
  let updated = 0;
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc) break;
    const expiresAt = new Date((doc.exp as number) * 1000);
    await col.updateOne({ _id: doc._id }, { $set: { expiresAt } });
    updated++;
  }
  console.log(`✅ Backfilled expiresAt on ${updated} link_tokens`);
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
