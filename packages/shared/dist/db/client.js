import { MongoClient, Db } from "mongodb";
let _client = null;
let _db = null;
let _connecting = null;
/** Internal: single MongoClient per process. */
async function getClient(uri) {
    if (_client)
        return _client;
    if (_connecting)
        return _connecting;
    const client = new MongoClient(uri);
    _connecting = client.connect().then((c) => {
        _client = c;
        _connecting = null;
        return c;
    });
    return _connecting;
}
/** Connect once on boot and cache the Db. */
export async function connectMongo(uri, dbName) {
    if (_db)
        return _db;
    const client = await getClient(uri);
    _db = client.db(dbName);
    return _db;
}
/** Sync getter: requires connectMongo() to have run. */
export function getDb() {
    if (!_db)
        throw new Error("Mongo not connected. Call connectMongo() first.");
    return _db;
}
/** Async getter: lazy-connect using env if needed. */
export async function getDbAsync() {
    if (_db)
        return _db;
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DB || "brainbot";
    if (!uri)
        throw new Error("MONGODB_URI missing");
    return connectMongo(uri, dbName);
}
/** Close client (tests / graceful shutdown). */
export async function closeMongo() {
    if (_client) {
        await _client.close();
        _client = null;
        _db = null;
    }
}
