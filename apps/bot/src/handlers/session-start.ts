// apps/bot/src/handlers/session-start.ts
import type { Telegraf } from "telegraf";
import { assignPaper } from "../services/paper-assigner.js";
import { SUBJECTS } from "../subjects.js";
import { resolvePaperContent } from "../repo/papersRepo.js";
import { SessionModel } from "../models/Session.js";
import { startSessionTimer, resolveExamPreset } from "../services/timer.js";

// NEW imports
import { getUserPlan } from "../repo/planRepo.js";
import { createSession } from "../repo/sessionRepo.js";

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// SUBJECTS can be strings or { slug, label }
function subjectLabelAt(index: number): string {
  const item = SUBJECTS[index] as any;
  return (item?.label as string) || String(item);
}

// --- exam preset normalization ---
type ExamPreset = "2h" | "2h30";

/** Normalize any legacy/input value to our enum */
function normalizeExamPreset(v: string | number | null | undefined): ExamPreset {
  const s = String(v ?? "2").trim().toLowerCase().replace(/\s+/g, "");
  if (s === "2.5" || s === "2h30" || s === "150" || s === "150m" || s === "2.5h" || s === "2hr30min") {
    return "2h30";
  }
  return "2h";
}

function presetHours(p: ExamPreset): number {
  return p === "2h30" ? 2.5 : 2;
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

    // Create a lightweight chooser row
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
    const text = (ctx.message as any)?.text?.trim();
    if (!text) return;

    const n = Number(text);
    if (!Number.isInteger(n) || n < 1 || n > SUBJECTS.length) return;

    const telegramId = String(ctx.from?.id ?? "");

    // Ensure we are choosing a subject for a pending session
    const shell = await SessionModel.findOne({
      telegramId,
      active: true,
      expiresAt: { $gt: new Date() },
    });

    if (!shell) return; // no active shell; ignore stray numbers
    if (shell.mode !== "awaiting-subject") {
      return ctx.reply("You already started a session. Send your answers, then type /finish.");
    }

    const subjectLabel = subjectLabelAt(n - 1);

    // Assign a paper for this subject
    const paper = await assignPaper(subjectLabel);
    if (!paper) {
      return ctx.reply("No paper available for that subject yet. Try another subject.");
    }

    const paperNum: 1 | 2 | 3 = Number(
      (paper as any).paper ?? (paper as any).paperNumber ?? 1
    ) as 1 | 2 | 3;

    // Decide exam preset and normalize
    const rawPreset = resolveExamPreset(subjectLabel, paperNum);
    const preset: ExamPreset = normalizeExamPreset(rawPreset);
    const paperHours = presetHours(preset);

    // Fetch current plan tier
    const plan = await getUserPlan(telegramId);

    // Create the real session
    const created = await createSession({
      telegramId,
      subjectIndex: n - 1,
      subjectLabel,
      paper: paperNum,
      tier: plan.tier,
      paperHours,
      examPreset: preset,
    });

    // Kick off the timer
    await startSessionTimer(ctx, String((created as any)._id ?? ""), {
      subjectLabel,
      paper: paperNum,
      preset,
    });

    // Deliver the paper
    const r = resolvePaperContent(paper as any);
    const caption = `${(paper as any).subject ?? subjectLabel} ${(paper as any).year ?? ""} – Paper ${paperNum}`.trim();

    if (r.kind === "pdf") {
      await ctx.replyWithDocument({ source: r.filePath }, { caption });
    } else {
      await ctx.replyWithHTML(
        `📘 <b>${escHtml(subjectLabel)}</b> AI-set available. (Rendering inline text/quiz in future versions)`
      );
    }

    // UX guidance with timing hints
    const totalWindow =
      plan.tier === "free"
        ? Math.min(paperHours + 1, 3.5)
        : plan.tier === "lite" || plan.tier === "steady"
        ? 4
        : plan.tier === "elite"
        ? 24
        : 6;

    const examLine = paperHours === 2.5 ? "⏱ Exam window: 2h 30m" : "⏱ Exam window: 2h";

    const extraLine =
      plan.tier === "free"
        ? `+ ${Math.max(0, totalWindow - paperHours)}h upload/mark buffer (capped at 3.5h total)`
        : plan.tier === "lite" || plan.tier === "steady"
        ? `→ Total window: 4h`
        : plan.tier === "elite"
        ? `→ Total window: 24h`
        : `→ Total window: 6h`;

    await ctx.replyWithHTML(
      `✅ <b>${escHtml(subjectLabel)}</b> paper assigned (Paper ${paperNum}).\n` +
        `${examLine} • ${extraLine}\n\n` +
        `Send your answers now:\n• Photos\n• PDFs\n• Voice notes\n• Text\n\n` +
        `When done, type <code>/finish</code>.`
    );
  });
}
