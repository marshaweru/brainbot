import { connectDB } from "./db";

export const FREE_SUBJECT_LIMIT = 2;

export async function claimFreeSubject(telegramId: string, subjectSlug: string) {
  const db = await connectDB();
  const users = db.collection("users");

  const res = await users.findOneAndUpdate(
    {
      telegramId,
      $expr: { $lt: [{ $size: { $ifNull: ["$free.subjects", []] } }, FREE_SUBJECT_LIMIT] },
    },
    {
      $addToSet: { "free.subjects": subjectSlug },
      $setOnInsert: { "free.createdAt": new Date() },
    },
    { upsert: true, returnDocument: "after" as const }
  );

  const value: any = (res as any)?.value ?? {};
  const subjects: string[] = value?.free?.subjects ?? [];
  const remaining = Math.max(0, FREE_SUBJECT_LIMIT - subjects.length);
  const atLimit = subjects.length >= FREE_SUBJECT_LIMIT;

  return { atLimit, subjects, remaining };
}

export async function getFreeState(telegramId: string) {
  const db = await connectDB();
  const users = db.collection("users");
  const doc: any = await users.findOne({ telegramId }, { projection: { "free.subjects": 1 } });
  const subjects: string[] = doc?.free?.subjects ?? [];
  return { subjects, remaining: Math.max(0, FREE_SUBJECT_LIMIT - subjects.length) };
}
