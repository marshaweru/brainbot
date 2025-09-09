import type { PlanTier } from "./plan.js";
import type { SubjectName } from "./subjects.js";
export type ObjectId = string;
export interface User {
    _id: ObjectId;
    webUserId?: string;
    telegramId?: string;
    username?: string;
    phone?: string;
    tier: PlanTier;
    expiresAt?: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface Session {
    _id: ObjectId;
    userId: ObjectId;
    subject: SubjectName;
    paper: 1 | 2 | 3;
    tierAtStart: PlanTier;
    startedAt: string;
    endedAt?: string;
    status: "in-progress" | "marked" | "expired";
}
export interface Attempt {
    _id: ObjectId;
    userId: ObjectId;
    sessionId: ObjectId;
    score: number;
    outOf: number;
    grade: string;
    rubric: {
        step: string;
        note: string;
        correct: boolean;
        mark: string;
    }[];
    criteria: {
        name: string;
        score: number;
        outOf: number;
    }[];
    pdfUrl?: string;
    createdAt: string;
}
export interface Payment {
    _id: ObjectId;
    userId?: ObjectId;
    amountKES: number;
    tier: Exclude<PlanTier, "free">;
    method: "stk" | "c2b";
    status: "pending" | "success" | "failed";
    mpesa?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}
