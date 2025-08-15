export const LANGUAGE_SUBJECTS = new Set([ "English", "Kiswahili", "Kiswahili Lugha", "English Language" ]);
export type SubjectType = "language" | "normal";
export function subjectType(name: string): SubjectType {
  const n = (name || "").trim(); if (LANGUAGE_SUBJECTS.has(n)) return "language"; return "normal";
}
export const QUICK_WINS: Record<string,string> = {
  "Physics": "Force & Pressure (Paper 1/2 high frequency)",
  "Chemistry": "Acids, Bases & Indicators (Paper 1/2)",
  "Mathematics": "Algebra & Functions (Paper 2 mini set)",
  "Geography": "Settlement & Land Use (Map Work)",
  "Biology": "Cell Structure & Transport",
  "English": "Functional Writing — Informal Letter",
  "Kiswahili": "Insha fupi + Sarufi (Sentensi)",
};
