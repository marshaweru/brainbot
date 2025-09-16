export type KCSESubject = "Mathematics" | "English" | "Kiswahili" | "Biology" | "Chemistry" | "Physics" | "History" | "Geography" | "CRE" | "Business";
export interface SessionResult {
    telegramId: number;
    plan: "free" | "lite" | "steady" | "serious" | "elite";
    subject: KCSESubject;
    paper: 1 | 2 | 3;
    score: number;
    startedAt: string;
    finishedAt: string;
    weakTopics: string[];
    remarks?: string;
}
