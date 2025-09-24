export function userLinks(db) {
    return db.collection("user_links");
}
export async function ensureUserLinksIndexes(db) {
    const col = userLinks(db);
    await col.createIndex({ wid: 1 }, { unique: true });
    await col.createIndex({ telegramId: 1 }, { sparse: true });
}
