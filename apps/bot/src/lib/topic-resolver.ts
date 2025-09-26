// Lightweight syllabus-aware topic resolver.
// Works even if the syllabus is empty. Safe to import everywhere.

import { SYLLABUS, type Syllabus } from "../content/syllabus.js";

export function resolveTopic(
  subject: string,
  rawTopic: string
): { canonical: string | null; suggestion?: string } {
  const subj = subject?.trim() || "Mathematics";
  const topic = (rawTopic || "").trim();
  if (!topic) return { canonical: null };

  const entry = (SYLLABUS as Syllabus)[subj];
  if (!entry || !entry.topics) return { canonical: topic }; // no syllabus yet → passthrough

  const t = topic.toLowerCase();

  // Exact canonical match
  if (entry.topics[topic]) return { canonical: topic };

  // Alias match
  for (const [canon, aliases] of Object.entries(entry.topics)) {
    if (canon.toLowerCase() === t) return { canonical: canon };
    if (aliases?.some((a) => a.toLowerCase() === t)) return { canonical: canon };
  }

  // Soft suggestion: prefix or includes match on canonicals
  const keys = Object.keys(entry.topics);
  const pref = keys.find((k) => k.toLowerCase().startsWith(t));
  if (pref) return { canonical: null, suggestion: pref };

  const incl = keys.find((k) => k.toLowerCase().includes(t));
  if (incl) return { canonical: null, suggestion: incl };

  return { canonical: null };
}
