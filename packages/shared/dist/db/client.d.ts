import { Db } from "mongodb";
/** Connect once on boot and cache the Db. */
export declare function connectMongo(uri: string, dbName: string): Promise<Db>;
/** Sync getter: requires connectMongo() to have run. */
export declare function getDb(): Db;
/** Async getter: lazy-connect using env if needed. */
export declare function getDbAsync(): Promise<Db>;
/** Close client (tests / graceful shutdown). */
export declare function closeMongo(): Promise<void>;
//# sourceMappingURL=client.d.ts.map