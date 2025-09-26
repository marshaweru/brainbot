// apps/bot/src/services/drill-service.ts
// Deterministic drill generator with seeded PRNG.
// Shape matches what your handlers expect: { questions: [{ q, a? }], tips? }.

export type DrillGenInput = {
  subject: string;
  topic: string;
  count: number;   // desired number of questions
  level: number;   // 0 easy … 3 insane
};

export type Drill = {
  subject: string;
  topic: string;
  questions: Array<{ q: string; a?: string }>;
  tips?: string[];
};

/* ---------- tiny seeded PRNG (Mulberry32) ---------- */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ---------- question banks (templated) ---------- */
const BASE_TEMPLATES = [
  (S: string, T: string) => `Define ${T} in the context of ${S}, and give one example.`,
  (_S: string, T: string) => `Solve a basic problem involving ${T}. Show key steps.`,
  (_S: string, T: string) => `List one common mistake learners make with ${T} and how to avoid it.`,
  (S: string, T: string) => `Explain where ${T} appears in real ${S} questions and how it’s assessed.`,
];

const HARD_TEMPLATES = [
  (_S: string, T: string) => `Create a tricky original question on ${T} and then solve it.`,
  (S: string, T: string) => `Contrast ${T} with a closely related concept in ${S}; give clear examples.`,
  (_S: string, T: string) => `Given a typical edge case for ${T}, explain why naive methods fail.`,
  (S: string, T: string) => `Design a 4-mark part (a) and a 6-mark part (b) on ${T} as in KCSE ${S}.`,
];

const INSANE_TEMPLATES = [
  (_S: string, T: string) => `Synthesize two subtopics around ${T} into one multi-step question; solve fully.`,
  (S: string, T: string) => `Propose a marking rubric (levels) for a ${S} question on ${T}.`,
];

/* ---------- stock “thin” answers to keep tests deterministic ---------- */
const STOCK_ANSWERS = [
  (S: string, T: string) => `A concise definition of ${T} with one relevant ${S} example.`,
  (_S: string, T: string) => `Worked solution steps for a standard ${T} question.`,
  (_S: string, T: string) => `Pitfall explained and a fix (method/heuristic) for ${T}.`,
];

/* ---------- tips library ---------- */
const TIPS = [
  (S: string, T: string) => `Underline keywords related to ${T} before planning your ${S} answer.`,
  (_S: string, T: string) => `Work backwards from what’s asked in ${T}; avoid info-dumps.`,
  (_S: string, T: string) => `After solving, sanity-check units, signs, and bounds for ${T}.`,
  (S: string) => `Budget time: attempt high-yield ${S} parts first, then circle back.`,
];

/* ---------- main ---------- */
export async function buildDrill(input: DrillGenInput): Promise<Drill> {
  const subject = input.subject.trim() || "Mathematics";
  const topic = input.topic.trim();
  const count = Math.max(1, Math.min(50, Math.floor(input.count || 8)));
  const level = Math.max(0, Math.min(3, Math.floor(input.level || 0)));

  // seeded randomness based on subject/topic/count/level
  const seed = hashString([subject, topic, count, level].join("#"));
  const rng = mulberry32(seed);

  // choose templates according to level
  const templates = [...BASE_TEMPLATES];
  if (level >= 1) templates.push(...HARD_TEMPLATES.slice(0, 1));      // normal: add 1 harder
  if (level >= 2) templates.push(...HARD_TEMPLATES.slice(1));         // hard: add all harder
  if (level >= 3) templates.push(...INSANE_TEMPLATES);                // insane: add synthesis

  // sample with replacement deterministically
  const qs: Array<{ q: string; a?: string }> = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * templates.length);
    const q = templates[idx](subject, topic);
    const maybeA = STOCK_ANSWERS[Math.floor(rng() * STOCK_ANSWERS.length)];
    // 50% chance of including a thin answer; higher for easy/normal to scaffold
    const includeA = level <= 1 ? rng() < 0.7 : rng() < 0.35;
    qs.push({ q, ...(includeA ? { a: maybeA(subject, topic) } : {}) });
  }

  // pick 2–3 tips deterministically
  const tipCount = 2 + Math.floor(rng() * 2);
  const tips: string[] = [];
  for (let i = 0; i < tipCount; i++) {
    const t = TIPS[Math.floor(rng() * TIPS.length)];
    tips.push(t(subject, topic));
  }

  return { subject, topic, questions: qs, tips };
}
