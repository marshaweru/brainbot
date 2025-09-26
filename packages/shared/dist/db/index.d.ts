export { connectMongo, getDb, getDbAsync, closeMongo } from "./client.js";
export { ensureWebIndexes } from "./ensureIndexes.js";
export { userLinks, ensureUserLinksIndexes } from "./models/userLinks.js";
export type { UserLink } from "./models/userLinks.js";
export type __DbPublicApi = {
    connectMongo: typeof import("./client.js").connectMongo;
    getDb: typeof import("./client.js").getDb;
    getDbAsync: typeof import("./client.js").getDbAsync;
    closeMongo: typeof import("./client.js").closeMongo;
    ensureWebIndexes: typeof import("./ensureIndexes.js").ensureWebIndexes;
    userLinks: typeof import("./models/userLinks.js").userLinks;
    ensureUserLinksIndexes: typeof import("./models/userLinks.js").ensureUserLinksIndexes;
    UserLink: import("./models/userLinks.js").UserLink;
};
//# sourceMappingURL=index.d.ts.map