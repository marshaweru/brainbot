// apps/bot/src/repo/feedbackRepo.ts
import { connectMongo } from "../db/mongo";
import { FeedbackModel } from "../models/Feedback";
import type { Feedback } from "../feedback/render";

/** Shape we read back from Mongo when using .lean() */
type FeedbackLean = {
  paper: string;
  subject: string;
  totalScore: number;
  outOf: number;
  grade: string;
  sections: { section: string; score: number; outOf: number }[];
  weakTopics: { topic: string; tip: string }[];
  rubric: { criterion: string; levels: string[] }[];
};

/** Save latest feedback for a user (append; newest wins). */
export async function saveFeedback(
  telegramId: string,
  fb: Feedback
): Promise<void> {
  await connectMongo();
  await FeedbackModel.create({
    telegramId,
    paper: fb.paper,
    subject: fb.subject,
    totalScore: fb.totalScore,
    outOf: fb.outOf,
    grade: fb.grade,
    sections: fb.sections,
    weakTopics: fb.weakTopics,
    rubric: fb.rubric,
  });
}

/** Load most recent feedback for a user. */
export async function getLatestFeedbackByTelegramId(
  telegramId: string
): Promise<Feedback | null> {
  await connectMongo();

  const doc = await FeedbackModel.findOne({ telegramId })
    .sort({ createdAt: -1 })
    .lean<FeedbackLean>()
    .exec();

  if (!doc) return null;

  // Map lean Mongo doc → in-bot Feedback type
  return {
    paper: doc.paper,
    subject: doc.subject,
    totalScore: doc.totalScore,
    outOf: doc.outOf,
    grade: doc.grade,
    sections: doc.sections.map((s) => ({
      section: s.section,
      score: s.score,
      outOf: s.outOf,
    })),
    weakTopics: doc.weakTopics.map((w) => ({ topic: w.topic, tip: w.tip })),
    rubric: doc.rubric.map((r) => ({ criterion: r.criterion, levels: r.levels })),
  };
}
