// apps/bot/src/utils/subjects.ts
import { labelBySlug, slugByLabel } from "../data/subjectsCatalog.js";

/**
 * Language detection + quick-topic hints (QUICK_WINS)
 * - Accepts either a subject LABEL ("Mathematics") or SLUG ("mat").
 * - Keeps backward-compatible exports: LANGUAGE_SUBJECTS, subjectType, QUICK_WINS.
 */

export type SubjectType = "language" | "normal";

/** ---- Loosen catalog key types at this boundary (user-input friendly) ---- */
const LBS = labelBySlug as unknown as Map<string, string>; // slug -> label
const SBL = slugByLabel as unknown as Map<string, string>; // label -> slug

/** Build a robust label set for language subjects (includes common aliases). */
const LANG_LABELS = new Set<string>([
  LBS.get("eng") || "English",
  LBS.get("kis") || "Kiswahili",
  "English Language",
  "Kiswahili Lugha",
]);

/** Back-compat: exported name used elsewhere. */
export const LANGUAGE_SUBJECTS = LANG_LABELS;

/** Case-insensitive label → slug (returns null if unknown) */
function labelToSlugInsensitive(label: string): string | null {
  const want = (label || "").trim().toLowerCase();
  if (!want) return null;

  // Fast exact lookup first (now accepts string)
  const exact = SBL.get(label);
  if (exact) return exact;

  // Case-insensitive scan (labels are few; cost is tiny)
  for (const [lbl, slug] of SBL.entries()) {
    if ((lbl || "").toLowerCase() === want) return slug;
  }
  return null;
}

/** Normalize input (label or slug) to a canonical slug where possible. */
function toSlug(input: string): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;

  const lc = raw.toLowerCase();

  // If it's already a known slug (eng/kis/mat/…)
  if (LBS.has(lc)) return lc;

  // Try label → slug
  return labelToSlugInsensitive(raw);
}

/** Determine if a subject (label or slug) is a language. */
export function subjectType(nameOrSlug: string): SubjectType {
  const slug = toSlug(nameOrSlug);
  if (slug === "eng" || slug === "kis") return "language";

  // Fallback by label set (handles aliases like "Kiswahili Lugha")
  const label = slug ? (LBS.get(slug) || nameOrSlug) : nameOrSlug;
  const isLang = [...LANG_LABELS].some(
    (l) => (l || "").toLowerCase() === (label || "").toLowerCase()
  );
  return isLang ? "language" : "normal";
}

/** High-frequency, student-friendly “quick win” topic seeds (keyed by LABEL). */
export const QUICK_WINS: Record<string, string> = {
  Mathematics: "Algebra & Functions (Paper 2 mini set)",
  Physics: "Force & Pressure (Paper 1/2 high frequency)",
  Chemistry: "Acids, Bases & Indicators (Paper 1/2)",
  Geography: "Settlement & Land Use (Map Work)",
  Biology: "Cell Structure & Transport",
  English: "Functional Writing — Informal Letter",
  Kiswahili: "Insha fupi + Sarufi (Sentensi)",
};
