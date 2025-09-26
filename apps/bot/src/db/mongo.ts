// apps/bot/src/db/mongo.ts
import mongoose from "mongoose";
import { SessionModel } from "../models/Session.js";
import { PerformanceModel } from "../models/Performance.js";
import { DrillLogModel } from "../models/DrillLog.js";

let pending: Promise<typeof mongoose> | null = null;
let indexesEnsured = false;

const DB_NAME = process.env.MONGODB_DB || "brainbot";
const MONGODB_URI = process.env.MONGODB_URI || "";
const MAX_POOL = Number(process.env.MONGODB_MAX_POOL || 10);
const SERVER_SELECTION_TIMEOUT_MS = Number(process.env.MONGODB_TIMEOUT_MS || 8000);
const SOCKET_TIMEOUT_MS = Number(process.env.MONGODB_SOCKET_TIMEOUT_MS || 20000);
const AUTO_INDEX = process.env.NODE_ENV !== "production"; // build in dev; use syncIndexes() in prod

if (!MONGODB_URI) {
  throw new Error("❌ MONGODB_URI is not set");
}

async function ensureBotIndexes() {
  if (indexesEnsured) return;
  try {
    // Keep model list tight; add more here as needed.
    await Promise.allSettled([
      SessionModel.syncIndexes(),
      PerformanceModel.syncIndexes(),
      DrillLogModel.syncIndexes(),
      // UserPlanModel?.syncIndexes?.(),
    ]);
    indexesEnsured = true;
    console.log("✅ Bot indexes ensured");
  } catch (e) {
    console.error("⚠️ ensureBotIndexes failed:", e);
  }
}

/** Connect once, reuse everywhere. Safe to call repeatedly. */
export async function connectMongo(): Promise<typeof mongoose> {
  // Already connected?
  if (mongoose.connection.readyState === 1) return mongoose;

  if (!pending) {
    // Start a single in-flight connection
    pending = mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      maxPoolSize: MAX_POOL,
      serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
      socketTimeoutMS: SOCKET_TIMEOUT_MS,
      // Avoid mongoose building indexes at start in prod; we call syncIndexes() ourselves
      autoIndex: AUTO_INDEX,
      // Leaner defaults; adjust if you need retryable writes/transactions
      retryWrites: true,
    } as any);

    // Basic telemetry
    mongoose.connection.on("error", (e) => console.error("[Mongo] error:", e));
    mongoose.connection.on("disconnected", () => console.warn("[Mongo] disconnected"));
  }

  await pending;
  console.log(`✅ Mongo connected (db="${DB_NAME}", pool=${MAX_POOL})`);

  // Ensure indexes once per process after connect
  await ensureBotIndexes();

  return mongoose;
}

/** Close pool cleanly (use on SIGINT/SIGTERM or in tests). */
export async function closeMongo(): Promise<void> {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log("🛑 Mongo closed");
    }
  } finally {
    pending = null;
    indexesEnsured = false;
  }
}

/** Optional helper for app entry to wire graceful shutdown. */
export function wireMongoShutdownSignals() {
  const shutdown = async (sig: NodeJS.Signals) => {
    try {
      await closeMongo();
    } finally {
      process.exit(0);
    }
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
