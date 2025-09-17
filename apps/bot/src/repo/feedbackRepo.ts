// apps/bot/src/repo/feedbackRepo.ts
import { connectMongo } from "../db/mongo.js";
import { FeedbackModel } from "../models/Feedback.js";
import type { Feedback } from "../feedback/render.js";

/** Shape loaded via .lean() — keep loose enough to survive schema tweaks */
type FeedbackLean = Partial<{
  paper: string;
  subject: string;
  totalScore: number;
  outOf: number;
  grade: string;
  sections: { section: string; score: number; outOf: number }[];
  weakTopics: { topic: string; tip: string }[];
  rubric: { criterion: string; levels: string[] }[];
}> & { createdAt?: Date };

/** Small helpers to avoid crashing on undefined arrays */
function asArray<T>(v: T[] | undefined | null): T[] {
  return Array.isArray(v) ? v : [];
}

function numOrUndefined(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Save latest feedback for a user (append; newest wins on read). */
export async function saveFeedback(telegramId: string, fb: Feedback): Promise<void> {
  await connectMongo();
  await FeedbackModel.create({
    telegramId,
    paper: fb.paper,
    subject: fb.subject,
    totalScore: fb.totalScore,
    outOf: fb.outOf,
    grade: fb.grade,
    sections: asArray(fb.sections),
    weakTopics: asArray(fb.weakTopics),
    rubric: asArray(fb.rubric),
  });
}

/**
 * NEW: Upsert-style helper used by markingRepo.
 * We persist a snapshot as another Feedback doc; your reader always picks the newest,
 * so an append is effectively an “upsert latest”.
 */
export async function upsertLatestFeedback(payload: {
  telegramId: string;
  subjectLabel: string;
  gradeNumeric?: number;      // 0..100
  gradeText?: string;         // "B+"
  weakTopics?: (string | { topic: string; tip?: string })[];
  remarks?: string;
  startedAt?: string;
  finishedAt?: string;
  plan?: string;
  feedback?: any;             // normalized object
}): Promise<void> {
  await connectMongo();

  // Normalize weakTopics into {topic, tip?}[]
  const weak = asArray(payload.weakTopics).map((w: any) =>
    typeof w === "string" ? { topic: w, tip: "" } : { topic: String(w?.topic ?? ""), tip: String(w?.tip ?? "") }
  );

  // Map to your FeedbackModel shape; stash extra fields inside rubric[] as metadata if needed later
  await FeedbackModel.create({
    telegramId: payload.telegramId,
    paper: "", // unknown here
    subject: payload.subjectLabel,
    totalScore: numOrUndefined(payload.gradeNumeric) ?? 0,
    outOf: 100,
    grade: payload.gradeText ?? "",
    sections: [],
    weakTopics: weak,
    rubric: [],

    // Optional: if your FeedbackModel allows arbitrary fields, you can include:
    // remarks: payload.remarks,
    // startedAt: payload.startedAt,
    // finishedAt: payload.finishedAt,
    // plan: payload.plan,
    // feedback: payload.feedback,
  });
}

/** Load most recent feedback for a user. Returns null if none found. */
export async function getLatestFeedbackByTelegramId(telegramId: string): Promise<Feedback | null> {
  await connectMongo();

  const doc = await FeedbackModel.findOne({ telegramId })
    .sort({ createdAt: -1 })
    .lean<FeedbackLean>()
    .exec();

  if (!doc) return null;

  // Map lean Mongo doc → in-bot Feedback type (defensive mapping)
  const sections = asArray(doc.sections).map((s) => ({
    section: String(s?.section ?? ""),
    score: numOrUndefined(s?.score) ?? 0,
    outOf: numOrUndefined(s?.outOf) ?? 0,
  }));

  const weakTopics = asArray(doc.weakTopics).map((w) => ({
    topic: String(w?.topic ?? ""),
    tip: String(w?.tip ?? ""),
  }));

  const rubric = asArray(doc.rubric).map((r) => ({
    criterion: String(r?.criterion ?? ""),
    levels: asArray(r?.levels ?? []).map((lv) => String(lv)),
  }));

  const mapped: Feedback = {
    paper: String(doc.paper ?? ""),
    subject: String(doc.subject ?? ""),
    totalScore: numOrUndefined(doc.totalScore) ?? 0,
    outOf: numOrUndefined(doc.outOf) ?? 0,
    grade: String(doc.grade ?? ""),
    sections,
    weakTopics,
    rubric,
  };

  return mapped;
}
