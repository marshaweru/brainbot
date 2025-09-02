// apps/bot/src/data/subjectsCatalog.ts

/** Canonical KCSE subjects (frozen for literal types) */
export const SUBJECTS = [
  { slug: "eng", label: "English" },
  { slug: "kis", label: "Kiswahili" },
  { slug: "mat", label: "Mathematics" },

  { slug: "bio", label: "Biology" },
  { slug: "chem", label: "Chemistry" },
  { slug: "phy", label: "Physics" },
  { slug: "gsc", label: "General Science" },

  { slug: "his", label: "History & Government" },
  { slug: "geo", label: "Geography" },
  { slug: "cre", label: "CRE" },

  { slug: "fr", label: "French" },
  { slug: "ger", label: "German" },
  { slug: "arb", label: "Arabic" },

  { slug: "bst", label: "Business Studies" },
  { slug: "cst", label: "Computer Studies" },
  { slug: "agr", label: "Agriculture" },
  { slug: "hme", label: "Home Science" },
  { slug: "wdw", label: "Woodwork" },
  { slug: "mtl", label: "Metalwork" },
  { slug: "elc", label: "Electricity" },
  { slug: "pwm", label: "Power Mechanics" },
] as const;

export type Subj = (typeof SUBJECTS)[number];
export type SubjectSlug = Subj["slug"];
export type SubjectLabel = Subj["label"];

/** Quick lookups */
export const labelBySlug = new Map<SubjectSlug, SubjectLabel>(
  SUBJECTS.map(s => [s.slug, s.label])
);
export const slugByLabel = new Map<SubjectLabel, SubjectSlug>(
  SUBJECTS.map(s => [s.label, s.slug])
);

/** Helpers */
export const ALL_SLUGS = SUBJECTS.map(s => s.slug) as SubjectSlug[];
export const LANGUAGE_SLUGS = ["eng", "kis"] as const;
export type LanguageSlug = (typeof LANGUAGE_SLUGS)[number];

export function isSubjectSlug(x: string): x is SubjectSlug {
  return (ALL_SLUGS as readonly string[]).includes(x);
}
export function isLanguageSlug(x: string): x is LanguageSlug {
  return (LANGUAGE_SLUGS as readonly string[]).includes(x as any);
}

/**
 * Default preselected subjects when the picker first opens / on "Reset".
 * We include Mathematics (compulsory) and ONE language by default (English).
 * Students can toggle to Kiswahili; the picker logic enforces "English OR Kiswahili".
 */
export const CORE_LABELS = [
  "Mathematics",
  "English",            // default language (can be switched to Kiswahili)
  "Biology",
  "Chemistry",
  "Physics",
  "Geography",
  "Business Studies",
] as const;

export const CORE_SLUGS = CORE_LABELS
  .map(l => slugByLabel.get(l)!)
  .filter(Boolean) as SubjectSlug[];

/** Convenience: quick-start subjects we surface in free trial & CTA */
export const QUICK_START_SLUGS = ["mat", "eng", "kis"] as const;

/** Compulsory set (Math + a language) */
export const COMPULSORY_SLUGS = ["mat", "eng", "kis"] as const;
