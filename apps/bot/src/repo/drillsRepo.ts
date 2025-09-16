// apps/bot/src/repo/drillsRepo.ts
import { DrillModel, DrillDoc } from "../models/Drill";

/** Create & persist a served drill set. Returns the saved doc (lean). */
export async function createDrill(params: {
  telegramId: string;
  subjectLabel: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard" | "normal" | "insane";
  questions: Array<{ q: string; a?: string }>;
  score?: number;
  outOf?: number;
}): Promise<DrillDoc> {
  const doc = await DrillModel.create({
    telegramId: params.telegramId,
    subjectLabel: params.subjectLabel,
    topic: params.topic,
    difficulty: params.difficulty,
    questions: params.questions,
    score: params.score ?? 0,
    outOf: params.outOf ?? params.questions.length ?? 0,
  });
  return doc.toObject() as DrillDoc;
}

/** Update score/outOf after a quick mark. */
export async function updateScore(drillId: string, score: number, outOf: number) {
  const doc = await DrillModel.findByIdAndUpdate(
    drillId,
    { $set: { score, outOf } },
    { new: true }
  ).lean<DrillDoc | null>();
  return doc;
}

/** Latest drills for this user (optionally filter by subject/topic). */
export async function listRecent(params: {
  telegramId: string;
  subjectLabel?: string;
  topic?: string;
  limit?: number;
}): Promise<DrillDoc[]> {
  const { telegramId, subjectLabel, topic, limit = 20 } = params;
  const q: any = { telegramId };
  if (subjectLabel) q.subjectLabel = subjectLabel;
  if (topic) q.topic = topic;

  return DrillModel.find(q)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<DrillDoc[]>();
}

/** Latest drill for a given topic. Handy for “repeat drills” queries. */
export async function getLatestByTopic(params: {
  telegramId: string;
  subjectLabel: string;
  topic: string;
}): Promise<DrillDoc | null> {
  const { telegramId, subjectLabel, topic } = params;
  return DrillModel.findOne({ telegramId, subjectLabel, topic })
    .sort({ createdAt: -1 })
    .lean<DrillDoc | null>();
}

/** Fetch a drill by its ID. */
export async function getById(drillId: string): Promise<DrillDoc | null> {
  return DrillModel.findById(drillId).lean<DrillDoc | null>();
}
