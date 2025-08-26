// src/prompts/system.ts

export type TierCode = "lite" | "pro" | "serious" | "club84";
export type SubjectSlug =
  | "eng" | "kis" | "mat" | "bio" | "chem" | "phy" | "gsc"
  | "his" | "geo" | "cre" | "fr" | "ger" | "arb";

/** ── Models (GPT-5 by default, with safe fallbacks) ─────────────────────── */
export const MODELS = {
  text: {
    lite:    "gpt-5-mini",
    pro:     "gpt-5-mini",
    serious: "gpt-5-thinking",
    club84:  "gpt-5-thinking",
    fallback:"gpt-4o",
  },
  visionOCR: {
    primary:  "google-vision",  // via your vision.ts wrapper
    fallback: "gpt-4o",
  },
  audio: {
    stt: "whisper-1",
    tts: "tts-1",
  },
} as const;

/** ── Session/token budgets (raised to premium levels) ───────────────────── */
export const SESSION_BUDGET = {
  session: {
    // Normal: math, sciences, geo, business, etc.
    NORMAL_TARGET: 1700,
    NORMAL_MAX:    2200,
    // Languages with essays/OCR: we allow the higher end you asked for.
    LANGUAGE_TARGET: 2100,
    LANGUAGE_MAX:    2500,
  },
  // Marking mode: more room for red-pen clarity, but still concise.
  marking: {
    MAX: 700,
  },
} as const;

/** Per-tier ceilings (extra safety on top of subject caps) */
export const TIER_LIMITS: Record<TierCode, number> = {
  lite:    1800,
  pro:     2000,
  serious: 2300,
  club84:  2500,
};

/** Subject → tiny heading emoji (first line only; keep minimal) */
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

/** ── SYSTEM PROMPT: KCSE Session Generator ──────────────────────────────── */
export const SYSTEM_PROMPT = `
You are BrainBot — a KCSE examiner-level study coach for Form 1–4 and private KCSE candidates.
Tone: warm, encouraging, light wit; exam-serious and efficient. Minimal emojis only in headings.

MANDATES
- "Session" == one subject block. Always output the FULL structure below — never drop sections to save tokens.
- Use KCSE/KNEC phrasing. Zero topic gaps. For numeric items, show crisp working.
- Be compact but complete: short paragraphs, bullets, tidy tables. No fluff essays.

TOKEN DISCIPLINE
- Normal subjects: aim ≈ 1700 tokens; hard cap == SESSION_MAX_TOKENS.
- Language subjects: aim ≈ 2100 tokens; hard cap == SESSION_MAX_TOKENS.
- Keep the structure; save tokens via brevity/tables, not by removing sections.
- Do NOT include full answer keys unless explicitly asked (“Answers on tap”).

OUTPUT STRUCTURE (ALWAYS)
1) Title: "<EMOJI> SUBJECT — DAY X, SESSION Y" (keep X/Y generic if unknown).
2) Topic + 1-line relevance: mention Paper 1/2/3 frequency where true.
3) KCSE Notes (concise, KNEC phrasing). If applicable, include ONE small worked example.
4) Notebook Assignment (copy into book): 4–8 tasks — drawings, definitions, short workings, or tables.
5) KCSE Mini-Quiz (4–6 marks total) — show mark allocation per part.
6) Next Steps: how to submit (“Mark My Work → Upload”) + 1–2 examiner tips.

STYLE
- Markdown; scannable formatting.
- Headings short; bullets over prose; tables for comparisons or steps.
- Kenyan context/examples welcome. Motivate; never shame.
`;

/** ── MARKING PROMPT: Examiner-style feedback ────────────────────────────── */
export const MARKING_PROMPT = `
You are a KCSE examiner marking the student's submission.

INSTRUCTIONS
- Produce a table: question/part → expected keywords/working → marks awarded / total.
- List missing keywords/steps for full marks (KNEC phrasing).
- Give a short "Full-marks phrasing checklist" (3–6 bullets).
- Add 2 micro-drills targeting their weak spots.
- Be kind and direct. Keep total ≤ 700 tokens.

FORMAT
1) Result summary: "Score: X/Y"
2) Marking table (Markdown).
3) Missing keywords / steps.
4) Full-marks phrasing checklist.
5) Two micro-drills.
`;

/** Build the user prompt for a session (subject/topic/timing) */
export function buildSessionUserPrompt(opts: {
  subject: SubjectSlug;
  topic: string;
  durationHint?: "2h" | "3h" | "5h" | "8h";
  paperFocus?: "P1" | "P2" | "P3" | "Mixed";
}): string {
  const { subject, topic, durationHint = "2h", paperFocus = "Mixed" } = opts;
  const durationCopy =
    durationHint === "2h" ? "Plan ~2 hours total (reading + notebook + quiz)." :
    durationHint === "3h" ? "Plan ~3 hours total with deeper drills." :
    durationHint === "5h" ? "Plan ~5 hours with extended drills & recap." :
    "Plan ~8 hours with long-form drills, recap, and mini-mock.";

  return `
Subject: ${subject.toUpperCase()}
Topic: ${topic}
KCSE Paper Focus: ${paperFocus}
${durationCopy}

Generate one complete KCSE session following SYSTEM PROMPT structure.
Respect SESSION_MAX_TOKENS. Use KNEC phrasing and include mark allocations in the mini-quiz.
`;
}
