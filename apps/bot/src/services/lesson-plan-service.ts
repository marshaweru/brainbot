import { readFile } from "node:fs/promises";
import Handlebars from "handlebars";
import { z } from "zod";
import { PROMPTS } from "../prompts/index.js";

export type LessonPlan = {
  subject: string;
  topic: string;
  level: string;
  objectives: string[];
  starter: string;
  core: Array<{ step: string; durationMin: number; method: "demo" | "guided" | "independent" | string }>;
  assessment: Array<{ check: string; whatToLookFor: string }>;
  homework: string;
  teacherNotes: string;
};

const LessonPlanJSON = z.object({
  subject: z.string(),
  topic: z.string(),
  level: z.string(),
  objectives: z.array(z.string()).default([]),
  starter: z.string(),
  core: z.array(
    z.object({
      step: z.string(),
      durationMin: z.number().min(0),
      method: z.string(),
    })
  ).default([]),
  assessment: z.array(
    z.object({
      check: z.string(),
      whatToLookFor: z.string(),
    })
  ).default([]),
  homework: z.string().default(""),
  teacherNotes: z.string().default(""),
});
type LessonPlanOut = z.infer<typeof LessonPlanJSON>;

export async function generateLessonPlan(params: {
  subject: string;
  topic: string;
  level?: string;
  llm?: (prompt: string) => Promise<string>;
}): Promise<LessonPlan> {
  const { subject, topic, level = "KCSE", llm } = params;

  // If no LLM yet, return a minimal skeleton (keeps flows alive)
  if (!llm) {
    return {
      subject, topic, level,
      objectives: ["State key definitions", "Apply method to a basic problem"],
      starter: "Quick recap of prior concept (3 min).",
      core: [
        { step: "Demonstrate worked example", durationMin: 12, method: "demo" },
        { step: "Guided practice (2 items)", durationMin: 12, method: "guided" },
        { step: "Independent check (2 items)", durationMin: 8, method: "independent" },
      ],
      assessment: [{ check: "2 MCQs + 1 short", whatToLookFor: "correct method + units" }],
      homework: "1–2 short items from the same topic.",
      teacherNotes: "Emphasize method marks and clean working.",
    };
  }

  // Render prompt
  const tpl = await readFile(PROMPTS.lessonPlan, "utf8");
  const prompt = Handlebars.compile(tpl)({ subject, topic, level });

  // Call LLM
  const raw = await llm(prompt);

  // Parse + validate JSON
  const parsed: LessonPlanOut = LessonPlanJSON.parse(JSON.parse(raw));

  return parsed;
}
