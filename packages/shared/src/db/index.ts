// DB entrypoint for @brainbot/shared/db
export { getDb } from "./client.js";
export { userLinks, ensureUserLinksIndexes } from "./models/userLinks.js";
export type { UserLink } from "./models/userLinks.js";
export { ensureWebIndexes } from "./ensureIndexes.js";
