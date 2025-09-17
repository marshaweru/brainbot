// apps/bot/src/handlers/session-start.ts
import { Telegraf } from "telegraf";
import path from "path";
import { fileURLToPath } from "url";
import { assignPaper } from "../services/paper-assigner";
import { SUBJECTS } from "../subjects";
import { resolvePaperContent } from "../repo/papersRepo";
import { SessionModel } from "../models/Session";
import { startSessionTimer, resolveExamPreset } from "../services/timer";

// ESM-safe __dirname/__filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// SUBJECTS can be strings or { slug, label }
function subjectLabelAt(index: number): string {
  const item = SUBJECTS[index];
  // @ts-ignore tolerate both shapes
  return (item?.label as string) || String(item);
}

export function registerSessionStart(bot: Telegraf) {
  // /session → if in-progress, remind; else create "awaiting-subject"
  bot.command("session", async (ctx) => {
    const telegramId = String(ctx.from?.id ?? "");

    const existing = await SessionModel.findOne({
      telegramId,
      active: true,
      expiresAt: { $gt: new Date() },
    }).lean();

    if (existing?.mode === "in-progress") {
      return ctx.reply(
        "You already have an active session. Send your answers (photo/pdf/voice/text), then type /finish."
      );
    }

    // End any currently-active session just in case (defensive)
    await SessionModel.updateMany(
      { telegramId, active: true, expiresAt: { $gt: new Date() } },
      { $set: { active: false } }
    );

    // Create a fresh session in "awaiting-subject" mode
    await SessionModel.create({
      telegramId,
      active: true,
      mode: "awaiting-subject",
      uploads: [],
    });

    // Build subject list
    const list = SUBJECTS.map((s, i) => {
      const label = (s as any)?.label ?? String(s);
      return `- <code>${i + 1}</code> ${escHtml(label)}`;
    }).join("\n");

    await ctx.reply(
      `<b>Start your KCSE session</b>\n\nPick a subject:\n${list}\n\n<i>Reply with the subject number.</i>`,
      { parse_mode: "HTML" }
    );
  });

  // 🔧 force-end any active session for this user
  bot.command(["end", "cancel", "reset"], async (ctx) => {
    const telegramId = String(ctx.from?.id ?? "");
    const res = await SessionModel.updateMany(
      { telegramId, active: true, expiresAt: { $gt: new Date() } },
      { $set: { active: false } }
    );
    await ctx.reply(
      res.modifiedCount > 0
        ? "✅ Ended your current session. Send /session to start again."
        : "No active session to end. Send /session to start one."
    );
  });

  // Number-only message = subject pick (only when awaiting-subject)
  bot.hears(/^[1-9]\d?$/, async (ctx) => {
    const telegramId = String(ctx.from?.id ?? "");
    const n = Number((ctx.message as any).text);

    if (n < 1 || n > SUBJECTS.length) return;

    // Make sure we are choosing a subject for a pending session
    const session = await SessionModel.findOne({
      telegramId,
      active: true,
      expiresAt: { $gt: new Date() },
    });

    if (!session) return; // no active shell; ignore stray numbers
    if (session.mode !== "awaiting-subject") {
      return ctx.reply("You already started a session. Send your answers, then type /finish.");
    }

    const subjectLabel = subjectLabelAt(n - 1);

    // Assign a paper for this subject
    const paper = await assignPaper(subjectLabel);
    if (!paper) {
      return ctx.reply("No paper available for that subject yet. Try another subject.");
    }

    // Normalize paper number field (supports either .paper or .paperNumber)
    const paperNum: 1 | 2 | 3 = (Number((paper as any).paper ?? (paper as any).paperNumber ?? 1) as 1 | 2 | 3);

    // Update session → in-progress + subject + paper
    session.mode = "in-progress";
    (session as any).subjectIndex = n - 1;
    (session as any).subjectLabel = subjectLabel;
    (session as any).paper = paperNum;

    // Decide exam preset (2h or 2h30), then start timer (also sets examEndsAt/uploadEndsAt/expiresAt)
    const preset = resolveExamPreset(subjectLabel, paperNum);
    (session as any).examPreset = preset;
    await session.save();

    // Kick off the timer (halfway + 10m exam, then 30m upload window pings)
    await startSessionTimer(ctx, String(session._id), { subjectLabel, paper: paperNum, preset });

    // Deliver the paper
    const r = resolvePaperContent(paper as any);
    const caption = `${paper.subject ?? subjectLabel} ${paper.year ?? ""} – Paper ${paperNum}`.trim();

    if (r.kind === "pdf") {
      await ctx.replyWithDocument({ source: r.filePath }, { caption });
    } else {
      // AI set placeholder; upgrade later to render items
      await ctx.replyWithHTML(
        `📘 <b>${escHtml(subjectLabel)}</b> AI-set available. (Rendering inline text/quiz in future versions)`
      );
    }

    // UX guidance with timing hints
    const timingLine =
      preset === "2h30"
        ? "⏱ Exam window: 2h 30m + 30m upload buffer."
        : "⏱ Exam window: 2h + 30m upload buffer.";

    await ctx.replyWithHTML(
      `✅ <b>${escHtml(subjectLabel)}</b> paper assigned (Paper ${paperNum}).\n${timingLine}\n\n` +
        `Send your answers now:\n• Photos\n• PDFs\n• Voice notes\n• Text\n\n` +
        `When done, type <code>/finish</code>.`
    );
  });
}
