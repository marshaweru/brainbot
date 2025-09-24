// apps/bot/src/db/mongo.ts
import mongoose from "mongoose";
import { SessionModel } from "../models/Session.js";
import { PerformanceModel } from "../models/Performance.js";
import { DrillLogModel } from "../models/DrillLog.js";
// import { UserPlanModel } from "../models/UserPlan"; // uncomment if you’ve defined it

let pending: Promise<typeof mongoose> | null = null;

async function ensureBotIndexes() {
  try {
    await Promise.allSettled([
      SessionModel.syncIndexes(),
      PerformanceModel.syncIndexes(),
      DrillLogModel.syncIndexes(),   // 👈 add this
    ]);
    console.log("✅ Bot indexes ensured");
  } catch (e) {
    console.error("⚠️ ensureBotIndexes failed:", e);
  }
}

export async function connectMongo() {
  if (!process.env.MONGODB_URI) throw new Error("❌ MONGODB_URI is not set");
  if (mongoose.connection.readyState === 1) return mongoose;

  if (!pending) {
    pending = mongoose.connect(process.env.MONGODB_URI as string, {
      dbName: process.env.MONGODB_DB || "brainbot",
    } as any);

    mongoose.connection.on("error", (e) => console.error("[Mongo] error:", e));
    mongoose.connection.on("disconnected", () => console.warn("[Mongo] disconnected"));
  }

  await pending;
  console.log("✅ Mongo connected");

  // run once after connect
  await ensureBotIndexes();

  return mongoose;
}
