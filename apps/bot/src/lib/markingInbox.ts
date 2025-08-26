// apps/bot/src/lib/markingInbox.ts
import { Context } from "telegraf";
import { getCollections } from "./db";
import type { Collection } from "mongodb";

export type PendingItem = {
  kind: "photo" | "image" | "pdf";
  fileId: string;
  mime?: string;
  addedAt: Date;
};

export type InboxStatus = "collecting" | "ready" | "processing" | "done";

type InboxDoc = {
  telegramId: string;
  chatId: number;
  status: InboxStatus;
  items: PendingItem[];
  createdAt: Date;
  updatedAt: Date;
};

function inboxColl(): Promise<Collection<InboxDoc>> {
  // Cast your untyped collection to our shape
  return getCollections().then(
    (c) => c.markingInbox as unknown as Collection<InboxDoc>
  );
}

function idsFrom(ctx: Context) {
  const telegramId = String(ctx.from?.id || "");
  const chatId = Number(ctx.chat?.id || 0);
  return { telegramId, chatId };
}

/** Push one pending item; returns the updated queued count. */
export async function pushPending(ctx: Context, item: PendingItem) {
  const { telegramId, chatId } = idsFrom(ctx);
  if (!telegramId || !chatId) return 0;

  const coll = await inboxColl();
  const filter = { telegramId, chatId, status: { $in: ["collecting", "ready"] as InboxStatus[] } };

  // upsert + push (no need to read ModifyResult types)
  await coll.updateOne(
    filter,
    {
      $setOnInsert: {
        telegramId,
        chatId,
        status: "collecting" as InboxStatus,
        items: [] as PendingItem[],
        createdAt: new Date(),
      },
      $set: { updatedAt: new Date(), status: "collecting" as InboxStatus },
      $push: { items: item },
    },
    { upsert: true }
  );

  // fetch latest to get count
  const doc = await coll.findOne(filter, { projection: { items: 1 } });
  return doc?.items?.length ?? 0;
}

export async function listPending(ctx: Context): Promise<PendingItem[]> {
  const { telegramId, chatId } = idsFrom(ctx);
  if (!telegramId || !chatId) return [];
  const coll = await inboxColl();
  const doc = await coll.findOne(
    { telegramId, chatId, status: { $in: ["collecting", "ready"] as InboxStatus[] } },
    { projection: { items: 1 } }
  );
  return doc?.items ?? [];
}

export async function clearPending(ctx: Context) {
  const { telegramId, chatId } = idsFrom(ctx);
  if (!telegramId || !chatId) return;
  const coll = await inboxColl();
  await coll.deleteOne({ telegramId, chatId, status: { $in: ["collecting", "ready"] as InboxStatus[] } });
}

export async function setStatus(ctx: Context, status: InboxStatus) {
  const { telegramId, chatId } = idsFrom(ctx);
  if (!telegramId || !chatId) return;
  const coll = await inboxColl();
  await coll.updateOne(
    { telegramId, chatId },
    { $set: { status, updatedAt: new Date() } },
    { upsert: true }
  );
}
