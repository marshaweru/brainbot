import type { Db, Collection } from "mongodb";
export type UserLink = {
    wid: string;
    telegramId?: string;
    starts?: number;
    lastStartAt?: Date;
    ua?: string;
    ip?: string;
    planHint?: string;
    linkedAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
};
export declare function userLinks(db: Db): Collection<UserLink>;
export declare function ensureUserLinksIndexes(db: Db): Promise<void>;
//# sourceMappingURL=userLinks.d.ts.map