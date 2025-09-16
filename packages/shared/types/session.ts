export type KCSESubject =
  | "Mathematics" | "English" | "Kiswahili" | "Biology" | "Chemistry"
  | "Physics" | "History" | "Geography" | "CRE" | "Business";

export interface SessionResult {
  telegramId: number;              // The student
  plan: "free" | "lite" | "steady" | "serious" | "elite";
  subject: KCSESubject;
  paper: 1 | 2 | 3;
  score: number;                   // 0..100
  startedAt: string;               // ISO
  finishedAt: string;              // ISO
  weakTopics: string[];            // extracted by bot
  remarks?: string;                // short feedback
}
