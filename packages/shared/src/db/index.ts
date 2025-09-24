// DB entrypoint for @brainbot/shared/db
export { getDb } from "./client";
export { userLinks, ensureUserLinksIndexes } from "./models/userLinks";
export type { UserLink } from "./models/userLinks";
export { ensureWebIndexes } from "./ensureIndexes";
