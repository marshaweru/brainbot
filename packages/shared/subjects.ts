// packages/shared/subjects.ts

/** Canonical KCSE subjects */
export const SUBJECTS = [
  { slug: "eng", label: "English" },
  { slug: "kis", label: "Kiswahili" },
  { slug: "mat", label: "Mathematics" },
  { slug: "bio", label: "Biology" },
  { slug: "chem", label: "Chemistry" },
  { slug: "phy", label: "Physics" },
  { slug: "his", label: "History & Government" },
  { slug: "geo", label: "Geography" },
  { slug: "cre", label: "CRE" },
  { slug: "bst", label: "Business Studies" }
] as const;

// literal union of subject slugs
export type SubjectSlug = typeof SUBJECTS[number]["slug"];

// human-readable labels
export type SubjectLabel = typeof SUBJECTS[number]["label"];

// alias for convenience
export type SubjectName = SubjectLabel | SubjectSlug;
