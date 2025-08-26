// apps/bot/src/scripts/debugFree.ts
import { connectDB } from "../lib/db";

async function main() {
  const telegramId = process.env.TEST_TELEGRAM_ID || "";
  if (!telegramId) throw new Error("Set TEST_TELEGRAM_ID");

  const db = await connectDB();
  const users = db.collection("users");
  const doc = await users.findOne(
    { telegramId: String(telegramId) },
    { projection: { telegramId: 1, free: 1 } }
  );
  console.log(JSON.stringify(doc, null, 2));
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
