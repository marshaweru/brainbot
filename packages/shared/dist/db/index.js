// DB entrypoint for @brainbot/shared/db  (NodeNext: keep .js in paths)
export { connectMongo, getDb, getDbAsync, closeMongo } from "./client.js";
export { ensureWebIndexes } from "./ensureIndexes.js";
export { userLinks, ensureUserLinksIndexes } from "./models/userLinks.js";
