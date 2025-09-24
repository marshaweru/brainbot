// apps/bot/src/repo/drillsRepo.ts
import { Types } from "mongoose";
import { connectMongo } from "../db/mongo.js";
import { DrillModel, DrillDoc } from "../models/Drill.js";

/** Persisted difficulty should be stable; "medium" → "normal" */
type DifficultyIn = "easy" | "medium" | "normal" | "hard" | "insane";
type DifficultyStored = Exclude<DifficultyIn, "medium">;
function normalizeDifficulty(d: DifficultyIn): DifficultyStored {
  return d === "medium" ? "normal" : d;
}

function sanitizeQuestions(
  arr: Array<{ q: string; a?: string }> | undefined
): Array<{ q: string; a?: string }> {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => ({
      q: String(x?.q ?? "").trim(),
      a: typeof x?.a === "string" ? x.a : undefined,
    }))
    .filter((x) => x.q.length > 0);
}

/** Create & persist a served drill set. Returns the saved doc (lean). */
export async function createDrill(params: {
  telegramId: string;
  subjectLabel: string;
  topic: string;
  difficulty: DifficultyIn;
  questions: Array<{ q: string; a?: string }>;
  score?: number;
  outOf?: number;
}): Promise<DrillDoc> {
  await connectMongo();

  const questions = sanitizeQuestions(params.questions);
  const outOf = params.outOf ?? questions.length ?? 0;

  const doc = await DrillModel.create({
    telegramId: params.telegramId,
    subjectLabel: params.subjectLabel,
    topic: params.topic,
    difficulty: normalizeDifficulty(params.difficulty),
    questions,
    score: params.score ?? 0,
    outOf,
  });

  // Use lean shape consistently across repo
  return doc.toObject() as DrillDoc;
}

/** Update score/outOf after a quick mark. Returns updated (lean) or null. */
export async function updateScore(
  drillId: string,
  score: number,
  outOf: number
) {
  await connectMongo();

  if (!Types.ObjectId.isValid(drillId)) return null;

  const doc = await DrillModel.findByIdAndUpdate(
    new Types.ObjectId(drillId),
    { $set: { score, outOf } },
    { new: true, projection: projection() }
  ).lean<DrillDoc | null>();

  return doc;
}

/** Latest drills for this user (optional subject/topic filters). */
export async function listRecent(params: {
  telegramId: string;
  subjectLabel?: string;
  topic?: string;
  limit?: number; // default 20, max 100
}) {
  await connectMongo();

  const { telegramId } = params;
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);

  const q: Record<string, unknown> = { telegramId };
  if (params.subjectLabel) q.subjectLabel = params.subjectLabel;
  if (params.topic) q.topic = params.topic;

  return DrillModel.find(q, projection())
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<DrillDoc[]>();
}

/** Latest drill for a given topic. Handy for “repeat drill” queries. */
export async function getLatestByTopic(params: {
  telegramId: string;
  subjectLabel: string;
  topic: string;
}) {
  await connectMongo();

  const { telegramId, subjectLabel, topic } = params;
  return DrillModel.findOne(
    { telegramId, subjectLabel, topic },
    projection()
  )
    .sort({ createdAt: -1 })
    .lean<DrillDoc | null>();
}

/** Fetch a drill by its ID (returns lean or null). */
export async function getById(drillId: string) {
  await connectMongo();

  if (!Types.ObjectId.isValid(drillId)) return null;

  return DrillModel.findById(new Types.ObjectId(drillId), projection())
    .lean<DrillDoc | null>();
}

/** Only fetch what dashboards need; hides heavy fields if any get added later. */
function projection() {
  return {
    telegramId: 1,
    subjectLabel: 1,
    topic: 1,
    difficulty: 1,
    questions: 1,
    score: 1,
    outOf: 1,
    createdAt: 1,
    updatedAt: 1,
  } as const;
}
