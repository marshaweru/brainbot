// apps/bot/src/feedback/adapter.ts
import type { Feedback } from "./render";

export type RawMarking = {
  paper: string;
  subject: string;
  total: number;
  outOf: number;
  grade: string;
  breakdown: { name: string; score: number; max: number }[];
  weak: { topic: string; tip: string }[];
  rubric: { criterion: string; levels: string[] }[];
};

export function toFeedback(raw: RawMarking): Feedback {
  return {
    paper: raw.paper,
    subject: raw.subject,
    totalScore: raw.total,
    outOf: raw.outOf,
    grade: raw.grade,
    sections: raw.breakdown.map((b) => ({
      section: b.name,
      score: b.score,
      outOf: b.max,
    })),
    weakTopics: raw.weak.map((w) => ({ topic: w.topic, tip: w.tip })),
    rubric: raw.rubric,
  };
}
