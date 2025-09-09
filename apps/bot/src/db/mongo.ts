// apps/bot/src/db/mongo.ts
import mongoose from "mongoose";

let pending: Promise<typeof mongoose> | null = null;

export async function connectMongo() {
  if (!process.env.MONGODB_URI) throw new Error("❌ MONGODB_URI is not set");
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!pending) {
    pending = mongoose.connect(process.env.MONGODB_URI as string, { dbName: undefined } as any);
    mongoose.connection.on("error", (e) => console.error("[Mongo] error:", e));
    mongoose.connection.on("disconnected", () => console.warn("[Mongo] disconnected"));
  }
  await pending;
  console.log("✅ Mongo connected");
  return mongoose;
}
