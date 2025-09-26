// apps/bot/src/services/drill-engine.ts
import { readFile } from "node:fs/promises";
import Handlebars from "handlebars";
import { z } from "zod";
import { resolveTopic } from "../lib/topic-resolver.js";
import { PROMPTS } from "../prompts/index.js";

/** ---------------------------------------
 * Types
 * --------------------------------------*/
export type DrillQuestion = {
  q: string;
  answer?: string;
  markingGuide?: string;
  difficulty?: number; // 0–3
};

export type GetDrillOptions = {
  /** Provide an LLM call: given a prompt, return the model's text. */
  llm?: (prompt: string) => Promise<string>;
  /** Override template path (defaults to PROMPTS.drillGenerator). */
  templatePath?: string;
  /** Force using fallback generator (skip LLM/template). */
  forceLocal?: boolean;
};

/** ---------------------------------------
 * Difficulty helpers
 * --------------------------------------*/
const DIFF_LABELS = ["easy", "normal", "hard", "insane"] as const;

function toDiffLabel(n: number): (typeof DIFF_LABELS)[number] {
  const i = Math.max(0, Math.min(3, n | 0));
  return DIFF_LABELS[i];
}

function fromDiffLabel(s: string): number {
  const idx = DIFF_LABELS.indexOf(s as any);
  return idx >= 0 ? idx : 1;
}

/** ---------------------------------------
 * Zod schema for LLM JSON
 * --------------------------------------*/
const DrillJSON = z.object({
  subject: z.string().min(1),
  topic: z.string().min(1),
  difficulty: z.string().min(1), // "easy" | "normal" | "hard" | "insane"
  questions: z
    .array(
      z.object({
        q: z.string().min(1),
        a: z.string().optional(),
        markingGuide: z.string().optional(),
      })
    )
    .min(1),
});
type DrillLLMOut = z.infer<typeof DrillJSON>;

/** ---------------------------------------
 * Local deterministic fallback generator
 * --------------------------------------*/
function seededRng(seed: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += h << 13;
    h ^= h >>> 7;
    h += h << 3;
    h ^= h >>> 17;
    h += h << 5;
    return (h >>> 0) / 4294967296;
  };
}

const BASE_TEMPLATES: Array<(s: string, t: string) => string> = [
  (s, t) => `Define ${t} in ${s} and give an example.`,
  (s, t) => `Solve a basic ${s} problem involving ${t}.`,
  (_s, t) => `List one common mistake with ${t} and how to avoid it.`,
];

const HARD_TEMPLATES: Array<(s: string, t: string) => string> = [
  (s, t) => `Design a 4-mark part (a) and a 6-mark part (b) on ${t} in ${s}.`,
  (_s, t) => `Pose a tricky edge-case question about ${t} and solve it.`,
];

const INSANE_TEMPLATES: Array<(s: string, t: string) => string> = [
  (_s, t) => `Synthesize ${t} with another topic into one multi-step KCSE problem.`,
  (s, t) => `Draft a marking rubric for a KCSE ${s} question on ${t}.`,
];

function localGenerate(
  subject: string,
  topic: string,
  count: number,
  difficulty: number
) {
  const rng = seededRng(`${subject}#${topic}#${count}#${difficulty}`);
  const templates = [...BASE_TEMPLATES];
  if (difficulty >= 1) templates.push(...HARD_TEMPLATES);
  if (difficulty >= 2) templates.push(...INSANE_TEMPLATES);

  const questions: DrillQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const fn = templates[Math.floor(rng() * templates.length)];
    const q = fn(subject, topic);
    const answer =
      difficulty <= 1
        ? `Straightforward outline for ${topic}.`
        : `Worked steps with reasoning for ${topic}.`;
    const markingGuide =
      difficulty >= 2
        ? `Allocate method marks; allow alternative valid approaches for ${topic}.`
        : `Award accuracy marks; penalize unit/format errors.`;
    questions.push({ q, answer, markingGuide, difficulty });
  }
  return { subject, topic, difficulty, questions };
}

/** ---------------------------------------
 * Main entry
 * --------------------------------------*/
export async function getDrill(
  subject: string,
  topic: string,
  count = 6,
  difficulty = 1,
  opts: GetDrillOptions = {}
) {
  const subj = (subject || "Mathematics").trim();

  // Canonicalize topic via syllabus resolver
  const { canonical, suggestion } = resolveTopic(subj, topic);
  if (!canonical) {
    topic = (suggestion ?? topic ?? "").trim();
  } else {
    topic = canonical.trim();
  }

  // If no LLM configured or forced local, use fallback
  if (!opts.llm || opts.forceLocal) {
    return localGenerate(subj, topic, count, difficulty);
  }

  // Load and compile Handlebars template
  const templatePath = opts.templatePath ?? PROMPTS.drillGenerator;

  let templateStr: string;
  try {
    templateStr = await readFile(templatePath, "utf8");
  } catch {
    return localGenerate(subj, topic, count, difficulty);
  }

  const template = Handlebars.compile(templateStr);
  const prompt = template({
    subject: subj,
    topic,
    difficulty: toDiffLabel(difficulty),
    count,
  });

  // Call LLM
  let raw: string;
  try {
    raw = await opts.llm(prompt);
  } catch {
    return localGenerate(subj, topic, count, difficulty);
  }

  // Parse + validate JSON
  try {
    const parsed: DrillLLMOut = DrillJSON.parse(JSON.parse(raw));

    const questions: DrillQuestion[] = parsed.questions.map(
      (q: { q: string; a?: string; markingGuide?: string }) => ({
        q: q.q,
        answer: q.a ?? undefined,
        markingGuide:
          q.markingGuide ??
          "Award method and accuracy marks; accept equivalent valid steps.",
        difficulty: fromDiffLabel(parsed.difficulty),
      })
    );

    return {
      subject: parsed.subject || subj,
      topic: parsed.topic || topic,
      difficulty: fromDiffLabel(parsed.difficulty),
      questions,
    };
  } catch {
    // If the model returned non-JSON or wrong shape, fall back
    return localGenerate(subj, topic, count, difficulty);
  }
}
