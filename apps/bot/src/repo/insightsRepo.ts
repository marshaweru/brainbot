// insightsRepo placeholder
import { connectMongo } from "../db/mongo.js";
import { InsightModel, type InsightDoc } from "../models/Insight.js";

const norm = (s: string) => s.trim().replace(/\s+/g, " ");

export async function getInsight(subject: string, topic: string): Promise<InsightDoc | null> {
  await connectMongo();
  return InsightModel.findOne({ subject: norm(subject), topic: norm(topic) })
    .lean<InsightDoc | null>();
}

export async function upsertInsight(data: {
  subject: string;
  topic: string;
  tips: string[];
  source?: string;
  quality?: number;
}): Promise<InsightDoc> {
  await connectMongo();
  const subject = norm(data.subject);
  const topic = norm(data.topic);
  const tips = Array.isArray(data.tips) ? data.tips.filter(Boolean) : [];

  const doc = await InsightModel.findOneAndUpdate(
    { subject, topic },
    {
      $setOnInsert: { subject, topic },
      $set: {
        tips,
        ...(data.source ? { source: data.source } : {}),
        ...(typeof data.quality === "number" ? { quality: data.quality } : {}),
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean<InsightDoc>();
  return doc!;
}

export async function addTips(subject: string, topic: string, tips: string[]) {
  await connectMongo();
  await InsightModel.updateOne(
    { subject: norm(subject), topic: norm(topic) },
    {
      $setOnInsert: { subject: norm(subject), topic: norm(topic) },
      $addToSet: { tips: { $each: tips.filter(Boolean) } },
      $set: { updatedAt: new Date() },
    },
    { upsert: true }
  );
}
