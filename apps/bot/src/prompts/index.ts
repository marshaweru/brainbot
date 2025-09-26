// apps/bot/src/prompts/index.ts
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PROMPTS = {
  drillGenerator: path.join(__dirname, "drill_generator.hbs"),
  examinerInsights: path.join(__dirname, "examiner_insights.hbs"),
  marking: path.join(__dirname, "marking.hbs"),
  notesSummarizer: path.join(__dirname, "notes_summarizer.hbs"),

  // 👇 add your new prompt here
  lessonPlan: path.join(__dirname, "lesson_plan.hbs"),
};

export type PromptKey = keyof typeof PROMPTS;
