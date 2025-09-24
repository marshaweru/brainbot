import { MongoClient, Db } from "mongodb";
import { ensureAnalyticsIndexes } from "@/lib/analytics/indexes";

// --- Config guards -----------------------------------------------------------
const uriEnv = process.env.MONGODB_URI;
if (!uriEnv || typeof uriEnv !== "string") {
  throw new Error("MONGODB_URI is not set");
}
const URI: string = uriEnv; // narrow to plain string for TS
const DB_NAME: string = process.env.MONGODB_DB || "brainbot";

// --- HMR-safe globals (Next.js dev) ------------------------------------------
type BBGlobals = {
  __bb_mongoClient?: Promise<MongoClient>;
  __bb_db?: Db | null;
  __bb_indexesDone?: boolean;
};
const g = globalThis as unknown as BBGlobals;

// --- Lazy loader: prefer shared package, fallback to local -------------------
async function loadWebIndexer(): Promise<(db: Db) => Promise<unknown>> {
  try {
    const mod = await import("@brainbot/shared/db");
    const fn =
      (mod as any).ensureWebIndexes ||
      (mod as any).ensureIndexes ||
      (mod as any).default;
    if (typeof fn === "function") return fn as (db: Db) => Promise<unknown>;
  } catch {
    // fall through
  }

  const local = await import("@/lib/indexes");
  const fn = (local as any).ensureWebIndexes || (local as any).default;
  if (typeof fn !== "function") {
    throw new Error(
      "No ensureWebIndexes function found in '@brainbot/shared/db' or '@/lib/indexes'"
    );
  }
  return fn as (db: Db) => Promise<unknown>;
}

// --- Cached handles ----------------------------------------------------------
let clientPromise = g.__bb_mongoClient ?? null;
let cachedDb: Db | null = g.__bb_db ?? null;
let indexesDone = g.__bb_indexesDone ?? false;

// --- Public DB accessor ------------------------------------------------------
export async function db(): Promise<Db> {
  if (cachedDb) return cachedDb;

  if (!clientPromise) {
    // URI is a guaranteed string now; assert for TS
    clientPromise = new MongoClient(URI as string).connect();
    g.__bb_mongoClient = clientPromise;
  }

  const client = await clientPromise;
  cachedDb = client.db(DB_NAME);
  g.__bb_db = cachedDb;

  if (!indexesDone) {
    try {
      const ensureWebIndexes = await loadWebIndexer();
      await ensureWebIndexes(cachedDb);
      console.log("✅ Web indexes ensured");
    } catch (e) {
      console.error("⚠️ ensureWebIndexes failed (continuing):", e);
    }

    try {
      await ensureAnalyticsIndexes(cachedDb);
      console.log("✅ Analytics indexes ensured");
    } catch (e) {
      console.warn("ℹ️ ensureAnalyticsIndexes skipped/failed:", e);
    }

    indexesDone = true;
    g.__bb_indexesDone = true;
  }

  return cachedDb;
}
