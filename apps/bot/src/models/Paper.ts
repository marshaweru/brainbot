export type KCSESubject =
  | "Mathematics" | "English" | "Kiswahili" | "Biology" | "Chemistry"
  | "Physics" | "History" | "Geography" | "CRE" | "Business";

export interface PaperMeta {
  id: string;                 // e.g. "math-2021-p1"
  subject: KCSESubject;
  paper: 1 | 2 | 3;
  year?: number;
  source: "kcse" | "mock" | "ai";
  filePath?: string;          // local PDF path (if stored locally)
  textUrl?: string;           // remote text/JSON (if generated)
}
// Paper model placeholder
