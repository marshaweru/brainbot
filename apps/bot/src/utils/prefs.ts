// apps/bot/src/utils/prefs.ts
import { getCollections } from "../lib/db";

export type VoiceLang = "auto" | "en" | "sw";
export type VoicePrefs = { tts: boolean; lang: VoiceLang };

const DEFAULT: VoicePrefs = { tts: false, lang: "auto" };

export async function getVoicePrefs(telegramId: string): Promise<VoicePrefs> {
  const { users } = await getCollections();
  const u = await users.findOne(
    { telegramId },
    { projection: { "prefs.voice": 1 } as any }
  );
  const p = (u as any)?.prefs?.voice;
  return {
    tts: typeof p?.tts === "boolean" ? p.tts : DEFAULT.tts,
    lang: (p?.lang as VoiceLang) ?? DEFAULT.lang,
  };
}

export async function setVoicePrefs(
  telegramId: string,
  patch: Partial<VoicePrefs>
): Promise<void> {
  const { users } = await getCollections();

  const $set: Record<string, any> = {};
  if (typeof patch.tts === "boolean") $set["prefs.voice.tts"] = patch.tts;
  if (patch.lang) $set["prefs.voice.lang"] = patch.lang;

  if (Object.keys($set).length === 0) return;

  await users.updateOne(
    { telegramId },
    {
      $set,
      $setOnInsert: { telegramId, createdAt: new Date() },
      $currentDate: { updatedAt: true },
    },
    { upsert: true }
  );
}
