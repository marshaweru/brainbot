// apps/bot/src/services/insights.ts
import { readFile } from "node:fs/promises";
import Handlebars from "handlebars";
import { z } from "zod";
import { PROMPTS } from "../prompts/index.js";

export type Insight = {
  tips: string[];
  raw?: any; // full examiner insights JSON if generated
};

const FALLBACK_TIPS = [
  "Show all your working clearly.",
  "Underline or highlight key words in the question.",
  "Check units and conversions carefully.",
];

/** -----------------------------
 * Zod schema for examiner_insights
 * ----------------------------- */
const ExaminerInsights = z.object({
  subject: z.string(),
  topics: z.array(z.string()),
  strengths: z.array(z.object({ area: z.string(), evidence: z.string() })).optional(),
  weaknesses: z
    .array(
      z.object({
        area: z.string(),
        evidence: z.string(),
        fix: z.string().optional(),
      })
    )
    .optional(),
  misconceptions: z
    .array(
      z.object({
        topic: z.string(),
        description: z.string(),
        examinerNote: z.string(),
      })
    )
    .optional(),
  actionPlan: z
    .object({
      drills: z
        .array(
          z.object({
            topic: z.string().optional(),
            count: z.number().optional(),
            difficulty: z.string().optional(),
          })
        )
        .optional(),
      pastPapers: z
        .array(
          z.object({
            paper: z.string().optional(),
            questionRef: z.string().optional(),
            why: z.string().optional(),
          })
        )
        .optional(),
      quickNotes: z
        .array(
          z.object({
            topic: z.string().optional(),
            note: z.string().optional(),
          })
        )
        .optional(),
    })
    .optional(),
  examinerTone: z.string().optional(),
});
type ExaminerInsightsOut = z.infer<typeof ExaminerInsights>;

/** -----------------------------
 * Main
 * ----------------------------- */
export async function getOrGenerateInsight(
  subject: string,
  topic: string,
  opts: { llm?: (prompt: string) => Promise<string>; level?: string } = {}
): Promise<Insight> {
  if (!opts.llm) {
    return {
      tips: [
        `In ${subject}, candidates often drop marks in ${topic} due to skipped steps.`,
        `Revise KNEC marking keywords for ${topic}.`,
        ...FALLBACK_TIPS,
      ],
    };
  }

  try {
    const tpl = await readFile(PROMPTS.examinerInsights, "utf8");
    const template = Handlebars.compile(tpl);
    const prompt = template({
      subject,
      topics: [topic].join(", "),
      topics_json: JSON.stringify([topic]),
      level: opts.level ?? "KCSE",
      attempt: "drill",
      sessionSummary: `Single-topic focus on ${topic}`,
      timeSpent: 0,
      marksAwarded: 0,
      marksTotal: 0,
      idealTimeMin: 0,
      syllabus_ids_json: "[]",
      paper_ids_json: "[]",
      ms_ids_json: "[]",
    });

    const raw = await opts.llm(prompt);
    const parsed = ExaminerInsights.parse(JSON.parse(raw));

    const tips: string[] = [];
    if (parsed.strengths) {
      for (const s of parsed.strengths) tips.push(`Strength: ${s.area} — ${s.evidence}`);
    }
    if (parsed.weaknesses) {
      for (const w of parsed.weaknesses) tips.push(`Weakness: ${w.area} — ${w.evidence}`);
    }
    if (parsed.misconceptions) {
      for (const m of parsed.misconceptions)
        tips.push(`Misconception: ${m.topic} — ${m.description}`);
    }
    if (parsed.examinerTone) tips.push(parsed.examinerTone);

    return { tips: tips.length ? tips : FALLBACK_TIPS, raw: parsed };
  } catch {
    return {
      tips: [
        `In ${subject}, candidates often drop marks in ${topic} due to skipped steps.`,
        `Revise KNEC marking keywords for ${topic}.`,
        ...FALLBACK_TIPS,
      ],
    };
  }
}
