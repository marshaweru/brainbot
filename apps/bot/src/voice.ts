// apps/bot/src/voice.ts
import { Telegraf, Context, Markup } from "telegraf";
import OpenAI from "openai";
import { Readable } from "node:stream";
import { toFile } from "openai/uploads";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import { fetch } from "undici";
import { getVoicePrefs, setVoicePrefs, type VoiceLang } from "./utils/prefs";

// ---------- OpenAI ----------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// ---------- FFmpeg ----------
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
} else {
  console.warn("[voice] ffmpeg-static not found; TTS → OGG may fail");
}

// ---------- Helpers ----------
async function downloadTelegramFile(ctx: Context, fileId: string): Promise<Buffer> {
  const link = await ctx.telegram.getFileLink(fileId);
  const res = await fetch(link.href);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

// Convert any input audio (mp3/wav/ogg) → OGG(OPUS) for Telegram voice notes
async function toOggOpus(input: Buffer): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const chunks: Buffer[] = [];
      const proc = ffmpeg(Readable.from(input))
        .noVideo()
        .audioCodec("libopus")
        .audioChannels(1)
        .audioFrequency(48000)
        .format("ogg")
        .on("error", (e) => reject(e))
        .on("end", () => resolve(Buffer.concat(chunks)))
        .pipe();

      proc.on("data", (c: Buffer) => chunks.push(c));
    } catch (e) {
      reject(e);
    }
  });
}

// STT (speech → text)
async function transcribe(buf: Buffer, filename = "audio.ogg", lang?: VoiceLang) {
  const file = await toFile(buf, filename, { type: "audio/ogg" });
  const language = lang && lang !== "auto" ? lang : undefined;

  try {
    const r: any = await openai.audio.transcriptions.create({
      file,
      model: "gpt-4o-mini-transcribe",
      language,
      response_format: "json",
    });
    return (r.text as string) || "";
  } catch {
    const r: any = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language,
      response_format: "json",
    });
    return (r.text as string) || "";
  }
}

// TTS (text → audio). Convert to Telegram-friendly OGG/OPUS.
async function synthesizeVoice(text: string): Promise<Buffer> {
  const MAX_TTS_CHARS = 900; // keep under ~60–90s
  const input = text.length > MAX_TTS_CHARS ? text.slice(0, MAX_TTS_CHARS) : text;

  const speech = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts", // or "tts-1" if enabled
    voice: "alloy",
    input,
  });

  const bytes = Buffer.from(await speech.arrayBuffer());
  return toOggOpus(bytes);
}

// Smart reply (checks per-user prefs; falls back to text on any error)
async function respond(ctx: Context, text: string) {
  const telegramId = ctx.from?.id?.toString();
  if (!telegramId) return ctx.reply(text);

  try {
    const prefs = await getVoicePrefs(telegramId);
    if (!prefs.tts) return ctx.reply(text);

    const ogg = await synthesizeVoice(text);
    const caption = text.length > 900 ? text : undefined;
    await ctx.replyWithVoice({ source: ogg }, { caption });
  } catch (e) {
    console.error("[voice] TTS/ffmpeg error:", (e as any)?.message || e);
    await ctx.reply(text);
  }
}

// Minimal QA (swap in your real Brain prompt later)
async function answerStudent(question: string): Promise<string> {
  const prompt = `You are BrainBot, a KCSE coach. Explain clearly and briefly in KCSE exam style. Question: ${question}`;
  const chat = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });
  return chat.choices[0]?.message?.content || "Got it — say that again?";
}

function isMarkRequest(text: string) {
  return /\bmark(ing)?\b|\bmark my work\b|\bplease mark\b/i.test(text);
}

// --- Mini card renderer ---
function renderVoiceCard(p: { tts: boolean; lang: VoiceLang }) {
  const status = p.tts ? "Voice + Text" : "Text only";
  const langLabel = p.lang === "en" ? "English" : p.lang === "sw" ? "Kiswahili" : "Auto";
  return [
    "🎙️ *Voice Preferences*",
    `• Reply style: *${status}*`,
    `• Speech language: *${langLabel}*`,
    "",
    "_Tip: Send a voice note to ask questions or say “mark my work”._",
  ].join("\n");
}

function prefsKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("🎤 Voice + Text", "VOICE_ON"),
      Markup.button.callback("💬 Text only", "VOICE_OFF"),
    ],
    [
      Markup.button.callback("🌐 Auto", "VOICE_LANG:auto"),
      Markup.button.callback("🇬🇧 English", "VOICE_LANG:en"),
      Markup.button.callback("🇰🇪 Kiswahili", "VOICE_LANG:sw"),
    ],
    [Markup.button.callback("🔊 Test Voice", "VOICE_TEST"), Markup.button.callback("ℹ️ Help", "VOICE_HELP")],
  ]);
}

// ---------- Public: register handlers ----------
export function registerVoice(bot: Telegraf) {
  // Preferences card + controls
  bot.command("voice", async (ctx) => {
    const telegramId = ctx.from?.id?.toString();
    const prefs = telegramId ? await getVoicePrefs(telegramId) : { tts: false, lang: "auto" as VoiceLang };
    await ctx.reply(renderVoiceCard(prefs), { parse_mode: "Markdown", ...prefsKeyboard() });
  });

  bot.action("VOICE_ON", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const telegramId = ctx.from?.id?.toString();
    if (telegramId) await setVoicePrefs(telegramId, { tts: true });
    const prefs = telegramId ? await getVoicePrefs(telegramId) : { tts: true, lang: "auto" as VoiceLang };
    await ctx.editMessageText(renderVoiceCard(prefs), { parse_mode: "Markdown", ...prefsKeyboard() }).catch(async () => {
      await ctx.reply(renderVoiceCard(prefs), { parse_mode: "Markdown", ...prefsKeyboard() });
    });
  });

  bot.action("VOICE_OFF", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const telegramId = ctx.from?.id?.toString();
    if (telegramId) await setVoicePrefs(telegramId, { tts: false });
    const prefs = telegramId ? await getVoicePrefs(telegramId) : { tts: false, lang: "auto" as VoiceLang };
    await ctx.editMessageText(renderVoiceCard(prefs), { parse_mode: "Markdown", ...prefsKeyboard() }).catch(async () => {
      await ctx.reply(renderVoiceCard(prefs), { parse_mode: "Markdown", ...prefsKeyboard() });
    });
  });

  bot.action(/^VOICE_LANG:(auto|en|sw)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const lang = ctx.match[1] as VoiceLang;
    const telegramId = ctx.from?.id?.toString();
    if (telegramId) await setVoicePrefs(telegramId, { lang });
    const prefs = telegramId ? await getVoicePrefs(telegramId) : { tts: false, lang };
    await ctx.editMessageText(renderVoiceCard(prefs), { parse_mode: "Markdown", ...prefsKeyboard() }).catch(async () => {
      await ctx.reply(renderVoiceCard(prefs), { parse_mode: "Markdown", ...prefsKeyboard() });
    });
  });

  // Open the Voice Preferences card from inline buttons (e.g., from /me)
bot.action("VOICE_OPEN", async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const telegramId = ctx.from?.id?.toString();
  const prefs = telegramId ? await getVoicePrefs(telegramId) : { tts: false, lang: "auto" as VoiceLang };
  await ctx.reply(renderVoiceCard(prefs), { parse_mode: "Markdown", ...prefsKeyboard() });
});

  // Voice test button — sends a short sample as a voice note (even if TTS is OFF)
  bot.action("VOICE_TEST", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    try {
      const telegramId = ctx.from?.id?.toString();
      const prefs = telegramId ? await getVoicePrefs(telegramId) : { tts: false, lang: "auto" as VoiceLang };
      const sample =
        prefs.lang === "sw"
          ? "Huu ni ukaguzi wa sauti wa BrainBot. Ikiwa unasikia vizuri, uko seti."
          : "This is a quick BrainBot voice check. If you can hear this clearly, you’re set.";
      const ogg = await synthesizeVoice(sample);
      await ctx.replyWithVoice(
        { source: ogg },
        { caption: prefs.tts ? undefined : "Voice preview (your replies are currently *Text only*)" }
      );
    } catch (e: any) {
      console.error("[voice] test error:", e?.message || e);
      await ctx.reply("Couldn’t play a test right now — try again in a moment?");
    }
  });

  bot.action("VOICE_HELP", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await ctx.reply(
      [
        "ℹ️ *How voice works*",
        "• Send a voice note to ask a question.",
        "• Say “mark my work” to get marking instructions.",
        "• Turn on *Voice + Text* if you want audio replies.",
        "• Choose *English* or *Kiswahili* under “Speech language”.",
      ].join("\n"),
      { parse_mode: "Markdown" }
    );
  });

  // Telegram voice notes (or audio clips)
  bot.on(["voice", "audio"], async (ctx) => {
    try {
      const msg: any = ctx.message;
      const voice = msg.voice || msg.audio;
      const fileId: string | undefined = voice?.file_id;
      if (!fileId) return;

      const telegramId = ctx.from?.id?.toString();
      const prefs = telegramId ? await getVoicePrefs(telegramId) : { tts: false, lang: "auto" as VoiceLang };

      const buf = await downloadTelegramFile(ctx, fileId);
      if (!buf?.length) return respond(ctx, "I couldn’t download that — try again?");

      const text = (await transcribe(buf, "input.ogg", prefs.lang)).trim();
      if (!text) return respond(ctx, "I couldn’t hear that well — try again?");

      if (isMarkRequest(text)) {
        return respond(
          ctx,
          "Cool — send a clear photo or PDF of your working. I’ll mark it KNEC-style and show where the marks are."
        );
      }

      const answer = await answerStudent(text);
      return respond(ctx, answer);
    } catch (e: any) {
      console.error("[voice] handler error:", e?.message || e);
      return ctx.reply("Audio was a bit crunchy — try again or type it out 👍");
    }
  });
}
