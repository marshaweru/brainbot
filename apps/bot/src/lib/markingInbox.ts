// apps/bot/src/lib/markingInbox.ts
import type { Collection, WithId } from "mongodb";
import { getCollections } from "../lib/db.js";

/* ---------- Types ---------- */

export type InboxItem = {
  kind: "photo" | "image" | "pdf";
  fileId: string;
  mime?: string;
  addedAt: Date;
};

export type InboxDoc = {
  telegramId: string;
  chatId: number;
  items: InboxItem[];
  status?: "open" | "done";
  createdAt?: Date;
  updatedAt?: Date;
};

/* ---------- Internals ---------- */

function keyFromCtx(ctx: any) {
  const telegramId = String(ctx?.from?.id ?? "");
  const chatId = Number(ctx?.chat?.id ?? 0);
  if (!telegramId || !chatId) throw new Error("markingInbox: missing telegramId/chatId");
  return { telegramId, chatId };
}

async function coll(): Promise<Collection<InboxDoc>> {
  const { markingInbox } = await getCollections();
  return markingInbox as unknown as Collection<InboxDoc>;
}

async function ensureOpenDoc(c: Collection<InboxDoc>, telegramId: string, chatId: number) {
  await c.updateOne(
    { telegramId, chatId, status: { $ne: "done" } },
    {
      $setOnInsert: {
        telegramId,
        chatId,
        items: [] as InboxItem[],
        status: "open" as const,
        createdAt: new Date(),
      },
      $set: { updatedAt: new Date() },
    },
    { upsert: true }
  );
}

/* ---------- Public API ---------- */

/** Queue a new item and return the new queue length. */
export async function pushPending(ctx: any, item: InboxItem): Promise<number> {
  const { telegramId, chatId } = keyFromCtx(ctx);
  const c = await coll();

  await ensureOpenDoc(c, telegramId, chatId);

  await c.updateOne(
    { telegramId, chatId, status: { $ne: "done" } },
    { $push: { items: item }, $set: { updatedAt: new Date() } }
  );

  const doc: WithId<InboxDoc> | null = await c.findOne({ telegramId, chatId, status: { $ne: "done" } });
  return doc?.items?.length ?? 0;
}

/** Get the current queue (creates an empty open doc if none). */
export async function listPending(ctx: any): Promise<InboxItem[]> {
  const { telegramId, chatId } = keyFromCtx(ctx);
  const c = await coll();

  await ensureOpenDoc(c, telegramId, chatId);

  const doc: WithId<InboxDoc> | null = await c.findOne({ telegramId, chatId, status: { $ne: "done" } });
  return doc?.items ?? [];
}

/** Clear any open queue for this chat. */
export async function clearPending(ctx: any): Promise<void> {
  const { telegramId, chatId } = keyFromCtx(ctx);
  const c = await coll();
  await c.deleteMany({ telegramId, chatId, status: { $ne: "done" } });
}


