// apps/bot/src/services/marking-service.ts
import { readFile } from "node:fs/promises";
import Handlebars from "handlebars";
import { z } from "zod";
import { PROMPTS } from "../prompts/index.js";

/** ---------- Types ---------- */
export type MarkingStep = {
  step: string;
  award: number;
  outOf: number;
  reason: string;
  schemeRef?: { msId: string | null; anchor: string | null };
};

export type MarkingError = {
  type: "concept" | "method" | "accuracy" | "unit" | "presentation";
  detail: string;
  penalty: string;
};

export type MarkingImprovement = {
  fix: string;
  syllabusRef?: { topicId: string | null; anchor: string | null };
};

export type MarkingResult = {
  subject: string;
  paper: string;
  questionRef: string;
  marks: { awarded: number; total: number };
  breakdown: MarkingStep[];
  errors: MarkingError[];
  improvements: MarkingImprovement[];
  examinerNote: string;
  /** Raw JSON from LLM when available (for audit/telemetry). */
  raw?: unknown;
};

/** ---------- Zod schema aligned to prompts/marking.hbs ---------- */
const MarkingJSON = z.object({
  subject: z.string(),
  paper: z.string(),
  questionRef: z.string(),
  marks: z.object({
    awarded: z.number().min(0),
    total: z.number().min(0),
  }),
  breakdown: z
    .array(
      z.object({
        step: z.string(),
        award: z.number().min(0),
        outOf: z.number().min(0),
        reason: z.string(),
        schemeRef: z
          .object({
            msId: z.string().nullable(),
            anchor: z.string().nullable(),
          })
          .optional(),
      })
    )
    .default([]),
  errors: z
    .array(
      z.object({
        type: z.enum(["concept", "method", "accuracy", "unit", "presentation"]),
        detail: z.string(),
        penalty: z.string(),
      })
    )
    .default([]),
  improvements: z
    .array(
      z.object({
        fix: z.string(),
        syllabusRef: z
          .object({
            topicId: z.string().nullable(),
            anchor: z.string().nullable(),
          })
          .optional(),
      })
    )
    .default([]),
  examinerNote: z.string(),
});

type MarkingJSONOut = z.infer<typeof MarkingJSON>;

/** ---------- Deterministic fallback (no LLM / bad JSON) ---------- */
function fallbackMarking(params: {
  subject: string;
  paper: string;
  questionRef: string;
  studentAnswer: string;
  marksTotal: number;
}): MarkingResult {
  const { subject, paper, questionRef, studentAnswer, marksTotal } = params;

  // Baby heuristics to award a token method mark if the answer looks structured.
  const hasWorkings =
    /\b(therefore|thus|=>|hence|let|assume|given|substitute|since)\b/i.test(
      studentAnswer || ""
    ) || /[=\-\+\*\/]\s*\d/.test(studentAnswer || "");

  const awarded = Math.min(marksTotal, hasWorkings ? Math.max(1, Math.floor(marksTotal * 0.2)) : 0);

  const breakdown: MarkingStep[] = [
    {
      step: "Method shown",
      award: hasWorkings ? Math.min(awarded, Math.ceil(marksTotal * 0.2)) : 0,
      outOf: Math.ceil(marksTotal * 0.2),
      reason: hasWorkings
        ? "Candidate shows a valid approach and intermediate steps (method marks)."
        : "No clear method or workings presented.",
      schemeRef: { msId: null, anchor: null },
    },
    {
      step: "Final accuracy",
      award: 0,
      outOf: marksTotal - Math.ceil(marksTotal * 0.2),
      reason: "Accuracy cannot be verified without full scheme.",
      schemeRef: { msId: null, anchor: null },
    },
  ];

  const errors: MarkingError[] = [
    {
      type: "presentation",
      detail: "Answer lacks clear structure and labeled steps.",
      penalty: "May lose method marks if workings are not traceable.",
    },
  ];

  const improvements: MarkingImprovement[] = [
    {
      fix: "Lay out steps line-by-line, label each transformation, and state assumptions/definitions where used.",
      syllabusRef: { topicId: null, anchor: null },
    },
  ];

  return {
    subject,
    paper,
    questionRef,
    marks: { awarded, total: marksTotal },
    breakdown,
    errors,
    improvements,
    examinerNote:
      "Show clear working and units; method marks are awarded even when final answers are off.",
  };
}

/** ---------- Main service ---------- */
export async function markAnswer(params: {
  subject: string;
  paper: string; // e.g., "Mathematics Paper 2"
  questionRef: string; // e.g., "Q5(b)"
  studentAnswer: string;
  marksTotal: number;
  opts?: {
    llm?: (prompt: string) => Promise<string>;
    syllabus_ids_json?: string; // JSON string array; optional for future wiring
    ms_ids_json?: string; // JSON string array; optional for future wiring
  };
}): Promise<MarkingResult> {
  const {
    subject,
    paper,
    questionRef,
    studentAnswer,
    marksTotal,
    opts = {},
  } = params;

  // If no LLM configured, return deterministic fallback
  if (!opts.llm) {
    return fallbackMarking({ subject, paper, questionRef, studentAnswer, marksTotal });
  }

  try {
    // Load prompt template
    const tpl = await readFile(PROMPTS.marking, "utf8");
    const template = Handlebars.compile(tpl);

    // Build prompt
    const prompt = template({
      subject,
      paper,
      questionRef,
      studentAnswer,
      marksTotal,
      syllabus_ids_json: opts.syllabus_ids_json ?? "[]",
      ms_ids_json: opts.ms_ids_json ?? "[]",
    });

    // Call LLM
    const raw = await opts.llm(prompt);

    // Parse + validate strict JSON from model
    const parsed: MarkingJSONOut = MarkingJSON.parse(JSON.parse(raw));

    // Safety: cap awarded ≤ total and non-negative
    const awarded = Math.max(0, Math.min(parsed.marks.awarded, parsed.marks.total));

    return {
      subject: parsed.subject || subject,
      paper: parsed.paper || paper,
      questionRef: parsed.questionRef || questionRef,
      marks: { awarded, total: parsed.marks.total },
      breakdown: parsed.breakdown?.map((b) => ({
        step: b.step,
        award: Math.max(0, b.award),
        outOf: Math.max(0, b.outOf),
        reason: b.reason,
        schemeRef: b.schemeRef ?? { msId: null, anchor: null },
      })) ?? [],
      errors: parsed.errors ?? [],
      improvements: parsed.improvements ?? [],
      examinerNote: parsed.examinerNote || "Marker feedback unavailable.",
      raw: parsed,
    };
  } catch {
    // Any failure → safe fallback so the session never crashes
    return fallbackMarking({ subject, paper, questionRef, studentAnswer, marksTotal });
  }
}
