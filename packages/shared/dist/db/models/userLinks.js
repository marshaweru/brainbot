export function userLinks(db) {
    return db.collection("user_links");
}
export async function ensureUserLinksIndexes(db) {
    const col = userLinks(db);
    await col.createIndex({ wid: 1 }, { unique: true, name: "user_links_wid_u" });
    await col.createIndex({ telegramId: 1 }, { sparse: true, name: "user_links_tg_u" });
}
