import "dotenv/config";
import { Telegraf, Markup } from "telegraf";
import { message } from "telegraf/filters";

import { SUBJECTS, subjectByNumber } from "./subjects";
import { registerExportPdf } from "./handlers/export-pdf";
import { toFeedback } from "./feedback/adapter";
import { buildFeedbackMessage, type Feedback } from "./feedback/render";
import { saveFeedback } from "./repo/feedbackRepo";

import {
  loadSession,
  setSession,
  addUpload,
  clearSession,
  type Upload,            // 👈 fixes “Cannot find name 'Upload'”
} from "./repo/sessionRepo";

import { connectMongo } from "./db/mongo";

import { handleMarking } from "./marking";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("❌ TELEGRAM_BOT_TOKEN is not set");

const bot = new Telegraf(BOT_TOKEN);

bot.catch((err, ctx) => {
  console.error("❌ Bot error for update", ctx?.update?.update_id, err);
});

registerExportPdf(bot);

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const subjectsList = () =>
  SUBJECTS.map((s) => `- <code>${s.idx}</code> ${escHtml(s.label)}`).join("\n");

// ---------- Feedback normalizer ----------
type RawMarking = {
  paper: string;
  subject: string;
  totalScore: number;
  outOf: number;
  grade: string;
  sections: { section: string; score: number; outOf: number }[];
  weakTopics: { topic: string; tip: string }[];
  rubric: { criterion: string; levels: string[] }[];
};

function toGrade(pct: number): string {
  if (pct >= 80) return "A";
  if (pct >= 75) return "A-";
  if (pct >= 70) return "B+";
  if (pct >= 65) return "B";
  if (pct >= 60) return "B-";
  if (pct >= 55) return "C+";
  if (pct >= 50) return "C";
  if (pct >= 45) return "C-";
  if (pct >= 40) return "D+";
  if (pct >= 35) return "D";
  if (pct >= 30) return "D-";
  return "E";
}

function normalizePipelineOutput(raw: any, subjectLabel?: string): RawMarking {
  let sections: { section: string; score: number; outOf: number }[] = [];
  let weakTopics: { topic: string; tip: string }[] = [];
  let rubric: { criterion: string; levels: string[] }[] = [];

  if (Array.isArray(raw?.sections)) {
    sections = raw.sections.map((s: any, idx: number) => ({
      section: String(s.name ?? s.section ?? `Section ${idx + 1}`),
      score: Number(s.score ?? 0),
      outOf: Number(s.outOf ?? 0),
    }));
  } else if (Array.isArray(raw?.questions)) {
    const bucket = new Map<string, { score: number; outOf: number }>();
    for (const q of raw.questions) {
      const key = String(q.section ?? "Paper");
      const cur = bucket.get(key) ?? { score: 0, outOf: 0 };
      cur.score += Number(q.score ?? 0);
      cur.outOf += Number(q.outOf ?? 0);
      bucket.set(key, cur);
      if (q.tip) {
        weakTopics.push({
          topic: String(q.topic ?? key),
          tip: String(q.tip),
        });
      }
    }
    sections = Array.from(bucket.entries()).map(([section, v]) => ({
      section,
      score: v.score,
      outOf: v.outOf,
    }));
  } else if (typeof raw?.score === "number" && typeof raw?.outOf === "number") {
    sections = [{ section: "Paper", score: Number(raw.score), outOf: Number(raw.outOf) }];
    if (raw.tip) weakTopics.push({ topic: "General", tip: String(raw.tip) });
  }

  if (Array.isArray(raw?.weakTopics)) {
    weakTopics = raw.weakTopics.map((w: any) => ({
      topic: String(w.topic ?? "Topic"),
      tip: String(w.tip ?? ""),
    }));
  }

  if (Array.isArray(raw?.rubric)) {
    rubric = raw.rubric.map((r: any) => {
      if (Array.isArray(r.levels)) {
        return {
          criterion: String(r.criterion ?? "Criterion"),
          levels: r.levels.map((x: any) => String(x)),
        };
      }
      const label =
        (r.step && String(r.step)) ||
        (r.criterion && String(r.criterion)) ||
        "Criterion";
      const mark =
        r.mark != null
          ? String(r.mark)
          : r.correct != null
          ? r.correct
            ? "Correct"
            : "Incorrect"
          : "";
      return { criterion: label, levels: [mark].filter(Boolean) };
    });
  }

  const totalScore = sections.reduce((s, x) => s + x.score, 0);
  const outOf = sections.reduce((s, x) => s + x.outOf, 0);
  const pct = outOf > 0 ? (totalScore / outOf) * 100 : 0;

  return {
    paper: String(raw?.paper ?? "Paper 1"),
    subject: String(subjectLabel ?? raw?.subject ?? "Subject"),
    totalScore,
    outOf,
    grade: String(raw?.grade ?? toGrade(pct)),
    sections,
    weakTopics,
    rubric,
  };
}

// ---------- Commands ----------
bot.start(async (ctx) => {
  await ctx.reply(
    `<b>Welcome to BrainBot!</b> 🚀
Your KCSE exam trainer.
• Start with a real KCSE paper.
• Upload your answers (photo, voice, text, or scanned docs).
• Get examiner feedback + PDF export.

<b>3-hour free session</b> (all features unlocked).

Type <code>/session</code> to begin.
Or <code>/upgrade</code> to unlock more features.

<b>Paybill:</b> 4168557
<b>Account Name:</b> Rizzline Africa
<b>Bill/Ref:</b> Your Telegram ID`,
    { parse_mode: "HTML" }
  );
});

bot.command("session", async (ctx) => {
  const uid = String(ctx.from?.id ?? "");
  await setSession(uid, {
    mode: "awaiting-subject",
    startedAt: Date.now(),
    subjectIndex: undefined,
    subjectLabel: undefined,
    uploads: [],
  });

  await ctx.reply(
    `<b>Start your free 3-hour KCSE session!</b>

Pick a subject to attempt:
${subjectsList()}

<i>Reply with the subject number.</i>`,
    { parse_mode: "HTML" }
  );
});

bot.on(message("text"), async (ctx, next) => {
  const uid = String(ctx.from?.id ?? "");
  const sess = await loadSession(uid);
  const text = (ctx.message as any).text?.trim() ?? "";

  if (sess.mode === "awaiting-subject") {
    const n = Number(text);
    if (!Number.isInteger(n) || n < 1 || n > SUBJECTS.length) {
      return ctx.reply("Please reply with a valid subject number from the list.");
    }

    const chosen = subjectByNumber(n);
    if (!chosen) return ctx.reply("That number isn’t on the list. Try again.");

    await setSession(uid, {
      mode: "in-progress",
      subjectIndex: n - 1,
      subjectLabel: chosen.label,
    });

    return ctx.reply(
      `✅ <b>${escHtml(chosen.label)}</b> selected.

<b>Send your answers now</b>:
• <b>Photos</b> (handwritten pages)
• <b>Voice notes</b> (explanations)
• <b>Documents</b> (PDFs or images)
• <b>Text</b> (typed answers)

When done, type <code>/finish</code> to get examiner feedback.`,
      { parse_mode: "HTML" }
    );
  }

  if (sess.mode === "in-progress" && !text.startsWith("/")) {
    const u: Upload = { kind: "text", text };
    await addUpload(uid, u);
    return ctx.reply("📝 Saved your text answer ✅");
  }

  return next();
});

bot.on(message("photo"), async (ctx) => {
  const uid = String(ctx.from?.id ?? "");
  const sess = await loadSession(uid);
  if (sess.mode !== "in-progress") return;

  const photos = (ctx.message as any).photo as Array<{
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
  }>;
  const fileId = photos?.[photos.length - 1]?.file_id;
  const caption = (ctx.message as any).caption as string | undefined;

  if (!fileId) return ctx.reply("Couldn't read the photo. Try again.");
  await addUpload(uid, { kind: "photo", fileId, caption });
  await ctx.reply("🖼️ Photo saved ✅");
});

bot.on(message("document"), async (ctx) => {
  const uid = String(ctx.from?.id ?? "");
  const sess = await loadSession(uid);
  if (sess.mode !== "in-progress") return;

  const doc = (ctx.message as any).document;
  const fileId = doc?.file_id as string | undefined;
  const mimeType = doc?.mime_type as string | undefined;
  const caption = (ctx.message as any).caption as string | undefined;

  if (!fileId) return ctx.reply("Couldn't read the document. Try again.");
  await addUpload(uid, { kind: "document", fileId, mimeType, caption });
  await ctx.reply("📄 Document saved ✅");
});

bot.on(message("voice"), async (ctx) => {
  const uid = String(ctx.from?.id ?? "");
  const sess = await loadSession(uid);
  if (sess.mode !== "in-progress") return;

  const voice = (ctx.message as any).voice;
  const fileId = voice?.file_id as string | undefined;
  const duration = voice?.duration as number | undefined;

  if (!fileId) return ctx.reply("Couldn't read the voice note. Try again.");
  await addUpload(uid, { kind: "voice", fileId, duration });
  await ctx.reply("🎙️ Voice note saved ✅");
});

bot.command("finish", async (ctx) => {
  const uid = String(ctx.from?.id ?? "");
  const sess = await loadSession(uid);

  if (sess.mode !== "in-progress" || sess.subjectIndex == null) {
    return ctx.reply("No active session. Start with /session first.");
  }

  const payload = {
    userId: uid,
    subject: sess.subjectLabel,
    uploads: sess.uploads,
    startedAt: sess.startedAt,
  };

  await ctx.reply("🧪 Marking your paper…");

  const pipelineRaw = await handleMarking(payload as any);
  const raw: RawMarking = normalizePipelineOutput(pipelineRaw, sess.subjectLabel);
  const feedback: Feedback = toFeedback(raw as any);

  await saveFeedback(uid, feedback);

  const msg = buildFeedbackMessage(feedback);
  await ctx.reply(msg, { parse_mode: "HTML" });

  await ctx.replyWithHTML(
    `<b>Download full PDF</b> (with diagrams & highlights)`,
    Markup.inlineKeyboard([[Markup.button.callback("📄 Export PDF", "export_pdf")]])
  );

  await clearSession(uid);
});

bot.command("upgrade", async (ctx) => {
  await ctx.reply(
    `<b>Upgrade to unlock more papers, hours, and features:</b>

• Lite Pass: 1 day, 1/day — KES 69
• Steady: 7 days, 1/day — KES 499
• Serious Prep: 30 days, 2/day — KES 2,999
• <b>Limited-Edition Prep Pass</b>: Only 1,499 (first 100)
• Elite: 30 days, 4/day, unlimited hours — KES 5,999

Pay via <b>M-PESA Paybill 4168557</b> (Ref: your Telegram ID).
Type <code>/paid</code> once you have paid.`,
    { parse_mode: "HTML" }
  );
});

(async () => {
  try {
    await connectMongo(); // show “✅ Mongo connected”

    const me = await bot.telegram.getMe();
    console.log(`🔑 Auth OK: @${me.username} (id ${me.id})`);
  } catch (err) {
    console.error("💥 startup error:", err);
  }

  await bot.launch();
  console.log("🚀 BrainBot Telegram bot running! Listening for updates…");
})();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
