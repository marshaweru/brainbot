import { MongoClient, Db, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI!;
if (!uri) throw new Error("❌ MONGODB_URI not set");

const dbName = process.env.MONGODB_DB || "brainbot";
const allowInsecure = process.env.MONGODB_TLS_INSECURE === "1";
const appName = process.env.MONGODB_APP_NAME || "brainbot-bot";
const maxPoolSize = Number(process.env.MONGODB_MAX_POOL || 10);

// TTLs
const markingInboxTtlDays = Number(process.env.MONGODB_MARKING_TTL_DAYS ?? 14);
const markingInboxExpireAfter = Math.max(1, Math.floor(markingInboxTtlDays * 24 * 60 * 60)); // seconds

// NEW: perf TTL (defaults to 90 days)
const perfTtlDays = Number(process.env.MONGODB_PERF_TTL_DAYS ?? 90);
const perfExpireAfter = Math.max(1, Math.floor(perfTtlDays * 24 * 60 * 60)); // seconds

const client = new MongoClient(uri, {
  appName,
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  serverSelectionTimeoutMS: 5_000,
  connectTimeoutMS: 10_000,
  socketTimeoutMS: 45_000,
  maxPoolSize,
  tls: true,
  ...(allowInsecure ? { tlsAllowInvalidCertificates: true, tlsAllowInvalidHostnames: true } : {}),
});

let db: Db | null = null;
let connectOnce: Promise<Db> | null = null;

async function ensureIndexes(d: Db) {
  await Promise.allSettled([
    d.collection("users").createIndex({ telegramId: 1 }, { unique: true, name: "uniq_telegramId" }),
    d.collection("payments").createIndex({ transID: 1 }, { unique: true, name: "uniq_transID" }),
    d.collection("payments").createIndex({ billRefNumber: 1, ts: -1 }, { name: "by_billRef_ts" }),
    d.collection("settings").createIndex({ key: 1 }, { unique: true, name: "uniq_key" }),
    d.collection("daily_counters").createIndex(
      { telegramId: 1, date: 1 },
      { unique: true, name: "uniq_daily_telegramId_date" }
    ),
    d.collection("usage_logs").createIndex({ telegramId: 1, date: 1 }, { name: "by_user_date" }),

    // Marking inbox
    d.collection("marking_inbox").createIndex(
      { telegramId: 1, chatId: 1, status: 1 },
      { name: "by_user_chat_status" }
    ),
    d.collection("marking_inbox").createIndex(
      { updatedAt: 1 },
      { name: "ttl_updatedAt", expireAfterSeconds: markingInboxExpireAfter }
    ),

    // 📚 Sessions (for reveal answers)
    d.collection("sessions").createIndex({ sessionId: 1 }, { unique: true, name: "uniq_sessionId" }),
    d.collection("sessions").createIndex({ telegramId: 1, createdAt: -1 }, { name: "by_user_createdAt" }),

    // ✅ NEW: perf metrics
    d.collection("perf").createIndex(
      { telegramId: 1, subject: 1, paper: 1, ts: -1 },
      { name: "by_user_subject_paper_ts" }
    ),
    d.collection("perf").createIndex({ ts: 1 }, { name: "ttl_ts", expireAfterSeconds: perfExpireAfter }),
  ]);
}

export async function connectDB(): Promise<Db> {
  if (db) return db;
  if (!connectOnce) {
    connectOnce = (async () => {
      await client.connect();
      const d = client.db(dbName);
      await d.command({ ping: 1 }).catch((e) => {
        throw new Error(`Mongo ping failed: ${(e as Error)?.message || e}`);
      });
      await ensureIndexes(d).catch((e) =>
        console.warn("[db] ensureIndexes warning:", (e as Error)?.message || e)
      );
      db = d;
      console.log(
        `✅ Mongo connected: ${d.databaseName} (appName=${appName}, pool=${maxPoolSize})` +
          (allowInsecure ? " [tlsAllowInvalidCertificates]" : "")
      );
      return d;
    })();
  }
  return connectOnce;
}

export async function getCollections() {
  const d = await connectDB();
  return {
    users: d.collection("users"),
    payments: d.collection("payments"),
    settings: d.collection("settings"),
    usage: d.collection("usage_logs"),
    dailyCounters: d.collection("daily_counters"),
    markingInbox: d.collection("marking_inbox"),
    sessions: d.collection("sessions"),
    perf: d.collection("perf"),
  };
}

export async function getUserSession(telegramId: string) {
  const { users } = await getCollections();
  return users.findOne({ telegramId });
}

/** Safe update helper that strips updatedAt if Mongo complains about a conflict. */
export async function safeUpdateOne(
  col: { updateOne: Function },
  filter: any,
  update: any,
  options?: any
) {
  try {
    return await col.updateOne(filter, update, options);
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (/updatedAt/i.test(msg) && /conflict/i.test(msg)) {
      const u = JSON.parse(JSON.stringify(update));
      if (u.$currentDate?.updatedAt) delete u.$currentDate.updatedAt;
      if (u.$set?.updatedAt) delete u.$set.updatedAt;
      return await col.updateOne(filter, u, options);
    }
    throw e;
  }
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.once(sig, async () => {
    try {
      await client.close();
      console.log("🔌 Mongo client closed");
    } catch {
      /* noop */
    }
  });
}
