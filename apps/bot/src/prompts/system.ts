// src/prompts/system.ts

export type TierCode = "lite" | "pro" | "serious" | "premium";
export type SubjectSlug =
  | "eng" | "kis" | "mat" | "bio" | "chem" | "phy" | "gsc"
  | "his" | "geo" | "cre" | "fr" | "ger" | "arb";

/** ── Models (GPT-5 by default, with safe fallbacks) ─────────────────────── */
export const MODELS = {
  text: {
    lite:    "gpt-5-mini",
    pro:     "gpt-5-mini",
    serious: "gpt-5-thinking",
    premium: "gpt-5-thinking",
    fallback:"gpt-4o",
  },
  visionOCR: {
    primary:  "google-vision",
    fallback: "gpt-4o",
  },
  audio: {
    stt: "whisper-1",
    tts: "tts-1",
  },
} as const;

/** ── Session/token budgets ──────────────────────────────────────────────── */
export const SESSION_BUDGET = {
  session: {
    NORMAL_TARGET:   1700,
    NORMAL_MAX:      2200,
    LANGUAGE_TARGET: 2100,
    LANGUAGE_MAX:    2500,
  },
  marking: { MAX: 700 },
} as const;

export const TIER_LIMITS: Record<TierCode, number> = {
  lite:    2000,
  pro:     2200,
  serious: 2400,
  premium: 2500,
};

export const SUBJECT_EMOJI: Record<SubjectSlug, string> = {
  eng: "📘", kis: "🗣️", mat: "🧮",
  bio: "🧬", chem: "🧪", phy: "⚙️", gsc: "🔬",
  his: "🏛️", geo: "🗺️", cre: "✨",
  fr:  "🇫🇷", ger: "🇩🇪", arb: "🇸🇦",
};

export function textModelForTier(tier: TierCode): string {
  return MODELS.text[tier] || MODELS.text.fallback;
}

export function sessionMaxTokens(subject: SubjectSlug, tier: TierCode): number {
  const isLang = subject === "eng" || subject === "kis";
  const baseMax = isLang
    ? SESSION_BUDGET.session.LANGUAGE_MAX
    : SESSION_BUDGET.session.NORMAL_MAX;
  return Math.min(baseMax, TIER_LIMITS[tier]);
}

/** ── CLASSIC SYSTEM PROMPT (kept for legacy fallbacks) ──────────────────── */
export const SYSTEM_PROMPT = `
You are BrainBot — a KCSE examiner-level study coach for Form 1–4 and private KCSE candidates.
Tone: warm, encouraging, light wit; exam-serious and efficient. Minimal emojis only in headings.

MANDATES
- "Session" == one subject block. Always output the FULL structure below — never drop sections.
- Use KCSE/KNEC phrasing. Zero topic gaps. For numeric items, show crisp working.
- Be compact but complete: short paragraphs, bullets, tidy tables. No fluff essays.

TOKEN DISCIPLINE
- Normal subjects: aim ≈ 1700 tokens; hard cap == SESSION_MAX_TOKENS.
- Language subjects: aim ≈ 2100 tokens; hard cap == SESSION_MAX_TOKENS.
- Keep the structure; be brief via bullets/tables, not by removing sections.

OUTPUT STRUCTURE (ALWAYS)
1) Title: "<EMOJI> SUBJECT — DAY X, SESSION Y"
2) Topic + 1-line relevance with Paper 1/2/3 frequency where true.
3) KCSE Notes (concise, KNEC phrasing) + ONE worked mini-example where helpful.
4) Notebook Assignment (4–8 short tasks).
5) KCSE Mini-Quiz (4–6 marks total) — with mark allocations.
6) Next Steps: “Mark My Work → Upload” + 1–2 examiner tips.
`;

/** ── REVEAL MODE SYSTEM PROMPT (JSON schema) ───────────────────────────── */
export const REVEAL_SYSTEM_PROMPT = `
You are BrainBot — a KCSE masterclass tutor. Generate ONE reveal-friendly session as **JSON** only.
No prose outside JSON. Keep within SESSION_MAX_TOKENS. KNEC phrasing. Kenyan context ok.

Return exactly a JSON object with these fields:

{
  "title":        "string (short, exam-like, e.g., 'KCSE PHYSICS – SESSION 2')",
  "topic":        "string (e.g., 'Force & Newton’s Laws')",
  "paper":        "P1 | P2 | P3 | Mixed",
  "notes_md":     "Markdown string: 8–12 examinable bullets + one mini worked example",
  "assignment_md":"Markdown string: 4–8 notebook tasks",
  "quiz": [
    {
      "id":        "Q1, Q2, ...",
      "q_md":      "Markdown stem only (no answers). Include part-marks in-line, e.g., '**(3 marks)**'.",
      "marks":     1..8,
      "answer_md": "Markdown model answer / marking points",
      "traps_md":  "Markdown bullets: 1–3 common traps"
    }
  ],
  "extras_md":    "Markdown string (examiner psychology, time-savers, format penalties)",
  "plan60_md":    "Markdown string (10’ concept • 35’ practice • 10’ marking • 5’ error journal)"
}

Rules:
- All answers go ONLY in "answer_md" (hidden in chat until revealed).
- The "q_md" must NOT contain the answer.
- Use realistic KCSE mark allocations and frequency tags [F:High|Med|Low] where useful in notes.
- Keep quotes < 12 words. No copyrighted text dumps.
- Be concise; use tables for comparisons; math in plain text/TeX (no images).
`;

/** Build a reveal-mode user prompt with tier + session hints */
export function buildRevealUserPrompt(opts: {
  subject: SubjectSlug;
  label: string;
  topic: string;
  paperFocus?: "P1" | "P2" | "P3" | "Mixed";
  level?: "F1" | "F2" | "F3" | "F4";
  monthsToKCSE?: number;
  durationHint?: "2h" | "3h" | "5h" | "8h";
  tier?: TierCode;
}) {
  const {
    subject, label, topic,
    paperFocus = "Mixed",
    level = "F4",
    monthsToKCSE = 6,
    durationHint = "2h",
    tier = "lite",
  } = opts;

  const durationCopy =
    durationHint === "2h" ? "Plan ~2 hours total (reading + notebook + quiz)." :
    durationHint === "3h" ? "Plan ~3 hours total with deeper drills." :
    durationHint === "5h" ? "Plan ~5 hours with extended drills & recap." :
                            "Plan ~8 hours with long-form drills, recap, and mini-mock.";

  // Everyone gets the full content; tier influences depth/angles, not access to answers.
  const tierNudge =
    tier === "premium" ? "Add examiner alternatives, rubrics, and time-saver heuristics in extras_md." :
    tier === "serious" ? "Add brief rubric snippets and common marking penalties in extras_md." :
    tier === "pro"     ? "Add 1–2 practical time tips in extras_md." :
                         "Keep extras_md concise but useful.";

  return `
Subject: ${label.toUpperCase()} (${subject})
KCSE Paper Focus: ${paperFocus}
Level: ${level}; Months to KCSE: ${monthsToKCSE}
Topic emphasis: ${topic}
${durationCopy}
${tierNudge}

Generate the JSON object per REVEAL schema. No text outside JSON. Respect SESSION_MAX_TOKENS.`;
}
