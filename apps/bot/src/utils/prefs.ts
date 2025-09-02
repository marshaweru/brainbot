// apps/bot/src/utils/prefs.ts
import { getCollections } from "../lib/db.js";
import type { SubjectSlug } from "../data/subjectsCatalog.js";

/* ---------------- Voice prefs ---------------- */

export type VoiceLang = "auto" | "en" | "sw";
export type VoicePrefs = { tts: boolean; lang: VoiceLang };

const DEFAULT_VOICE: VoicePrefs = { tts: false, lang: "auto" };

export async function getVoicePrefs(telegramId: string): Promise<VoicePrefs> {
  const { users } = await getCollections();
  const u = await users.findOne({ telegramId }, { projection: { "prefs.voice": 1 } as any });
  const p = (u as any)?.prefs?.voice;
  return {
    tts: typeof p?.tts === "boolean" ? p.tts : DEFAULT_VOICE.tts,
    lang: (p?.lang as VoiceLang) ?? DEFAULT_VOICE.lang,
  };
}

export async function setVoicePrefs(telegramId: string, patch: Partial<VoicePrefs>): Promise<void> {
  const { users } = await getCollections();

  const $set: Record<string, any> = { updatedAt: new Date() };
  if (typeof patch.tts === "boolean") $set["prefs.voice.tts"] = patch.tts;
  if (patch.lang) $set["prefs.voice.lang"] = patch.lang;

  if (Object.keys($set).length <= 1) return; // only updatedAt — nothing to change

  try {
    await users.updateOne(
      { telegramId },
      { $set, $setOnInsert: { telegramId, createdAt: new Date() } },
      { upsert: true }
    );
  } catch (e: any) {
    if (e?.code !== 11000) throw e;
  }
}

/* ---------------- Last session meta ---------------- */

export type PaperFocus = "P1" | "P2" | "P3" | "Mixed" | "auto" | undefined;
export type LastSessionMeta = { subject: SubjectSlug; paper?: PaperFocus; at?: Date };

export async function getLastSessionMeta(telegramId: string): Promise<LastSessionMeta | null> {
  const { users } = await getCollections();
  const u = await users.findOne({ telegramId }, { projection: { "prefs.lastSession": 1 } as any });
  const ls = (u as any)?.prefs?.lastSession;
  if (!ls) return null;
  return {
    subject: ls.subject as SubjectSlug,
    paper: ls.paper as PaperFocus,
    at: ls.at ? new Date(ls.at) : undefined,
  };
}

export async function setLastSessionMeta(telegramId: string, meta: { subject: SubjectSlug; paper?: PaperFocus }) {
  const { users } = await getCollections();
  try {
    await users.updateOne(
      { telegramId },
      {
        $set: {
          "prefs.lastSession.subject": meta.subject,
          ...(meta.paper ? { "prefs.lastSession.paper": meta.paper } : {}),
          "prefs.lastSession.at": new Date(),
          updatedAt: new Date(),
        },
        $setOnInsert: { telegramId, createdAt: new Date() },
      },
      { upsert: true }
    );
  } catch (e: any) {
    if (e?.code !== 11000) throw e;
  }
}

/* ---------------- Upgrade nudge (for delayed upsell) ---------------- */

export type UpgradeNudge = { after: "marking" | "none"; setAt: Date };

export async function setUpgradeNudge(telegramId: string, n: { after: "marking" | "none" }) {
  const { users } = await getCollections();
  await users.updateOne(
    { telegramId },
    {
      $set: {
        "prefs.upgradeNudge": { after: n.after, setAt: new Date() },
        updatedAt: new Date(),
      },
      $setOnInsert: { telegramId, createdAt: new Date() },
    },
    { upsert: true }
  );
}

export async function getAndClearUpgradeNudge(telegramId: string): Promise<UpgradeNudge | null> {
  const { users } = await getCollections();
  const r = await users.findOneAndUpdate(
    { telegramId },
    { $unset: { "prefs.upgradeNudge": "" }, $set: { updatedAt: new Date() } },
    { projection: { "prefs.upgradeNudge": 1 } as any, returnDocument: "before" }
  );
  return (r?.value as any)?.prefs?.upgradeNudge ?? null;
}
