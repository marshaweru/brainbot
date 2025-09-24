import { Types } from "mongoose";
import { DrillLogModel } from "../models/DrillLog.js";
import { connectMongo } from "../db/mongo.js";

export async function startDrillLog(input: {
  telegramId: string;
  subjectLabel: string;
  topic: string;
  difficulty: "easy" | "normal" | "hard" | "insane";
  outOf: number;
}) {
  await connectMongo();
  const doc = await DrillLogModel.create({
    telegramId: input.telegramId,
    subjectLabel: input.subjectLabel,
    topic: input.topic,
    difficulty: input.difficulty,
    outOf: input.outOf,
  });
  return doc._id as Types.ObjectId;
}

export async function touchDrillLog(id: string | Types.ObjectId) {
  await connectMongo();
  await DrillLogModel.updateOne(
    { _id: new Types.ObjectId(String(id)) },
    { $set: { lastActivityAt: new Date() } }
  ).exec();
}

// Optional for later when you grade drills:
export async function finishDrillLog(id: string | Types.ObjectId, score: number) {
  await connectMongo();
  await DrillLogModel.updateOne(
    { _id: new Types.ObjectId(String(id)) },
    { $set: { score, lastActivityAt: new Date() } }
  ).exec();
}
