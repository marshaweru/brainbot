// Canonical KCSE subject catalog (no Telegraf deps here)
export type Subj = { slug: string; label: string };

export const SUBJECTS: Subj[] = [
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
];

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
];

export const labelBySlug = new Map(SUBJECTS.map(s => [s.slug, s.label]));
export const slugByLabel = new Map(SUBJECTS.map(s => [s.label, s.slug]));

/** Convenience: core set as slugs (useful for defaults, tests, etc.) */
export const CORE_SLUGS: string[] =
  CORE_LABELS.map(l => slugByLabel.get(l)!).filter(Boolean) as string[];

/** Convenience: quick-start subjects we surface in free trial & CTA */
export const QUICK_START_SLUGS = ["mat", "eng", "kis"] as const;
