// apps/bot/src/subjects.ts

export type Subject = {
  idx: number;   // numeric code a student types
  slug: string;  // short machine-friendly ID
  label: string; // human-friendly display
};

export const SUBJECTS: readonly Subject[] = [
  { idx: 1, slug: "eng", label: "English" },
  { idx: 2, slug: "kis", label: "Kiswahili" },
  { idx: 3, slug: "mat", label: "Mathematics" },
  { idx: 4, slug: "bio", label: "Biology" },
  { idx: 5, slug: "chem", label: "Chemistry" },
  { idx: 6, slug: "phy", label: "Physics" },
  { idx: 7, slug: "his", label: "History & Government" },
  { idx: 8, slug: "geo", label: "Geography" },
  { idx: 9, slug: "cre", label: "CRE" },
  { idx: 10, slug: "bst", label: "Business Studies" },
] as const;

export function subjectByNumber(n: number): Subject | undefined {
  return SUBJECTS.find(s => s.idx === n);
}
