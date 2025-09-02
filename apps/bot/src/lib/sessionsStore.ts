import type { Collection } from "mongodb";
import { getCollections } from "./db.js";

export type RevealPiece = {
  stem: string;            // visible question text (no spoilers)
  hint?: string;           // short nudge
  marks?: string;          // marking scheme (bullets)
  answer?: string;         // model answer
};

export type SessionDoc = {
  telegramId: string;
  sessionId: string;
  subjectSlug: string;
  createdAt: Date;
  visibleMessageId?: number;
  questions: RevealPiece[];
  tried: Record<number, boolean>;  // qIndex -> tried?
};

async function coll(): Promise<Collection<SessionDoc>> {
  const { sessions } = await getCollections();
  return sessions as unknown as Collection<SessionDoc>;
}

export async function upsertSessionDoc(doc: SessionDoc) {
  const c = await coll();
  await c.updateOne(
    { telegramId: doc.telegramId, sessionId: doc.sessionId },
    { $set: doc },
    { upsert: true }
  );
}

export async function loadSessionDoc(telegramId: string, sessionId: string) {
  const c = await coll();
  return c.findOne({ telegramId, sessionId });
}

export async function markTried(telegramId: string, sessionId: string, qIndex: number) {
  const c = await coll();
  await c.updateOne(
    { telegramId, sessionId },
    { $set: { [`tried.${qIndex}`]: true } }
  );
}

export type GateCheck = { canShow: boolean; waitLeftSec?: number; reason?: string };

export function gateReveal(opts: {
  doc: SessionDoc | null;
  qIndex: number;
  kind: "marks" | "answer";
}): GateCheck {
  if (!opts.doc) return { canShow: false, reason: "no-session" };
  const tried = !!opts.doc.tried?.[opts.qIndex];

  // Gentle gates: allow even without "I tried" after a short wait
  const postedAt = opts.doc.createdAt instanceof Date ? opts.doc.createdAt : new Date();
  const elapsedSec = Math.max(0, Math.floor((Date.now() - postedAt.getTime()) / 1000));
  const required = opts.kind === "marks" ? 45 : 90;

  if (tried || elapsedSec >= required) return { canShow: true };
  return { canShow: false, waitLeftSec: Math.max(0, required - elapsedSec) };
}
