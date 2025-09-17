// apps/bot/src/services/timer.ts
import type { Context } from "telegraf";
import { SessionModel } from "../models/Session.js";

type DurationPreset = "2h" | "2h30"; // exam window length (upload buffer is always +30m)

/**
 * Resolve exam duration by subject/paper (adjust mapping as needed).
 * - Most papers: 2h
 * - Some papers: 2h30 (e.g., certain essays/compositions)
 */
export function resolveExamPreset(subjectLabel?: string, paper?: 1 | 2 | 3): DurationPreset {
  const s = (subjectLabel ?? "").toLowerCase();

  // Example heuristics — tweak to your rules:
  // English Paper 1/2, Kiswahili Insha/Comprehension often run longer
  if (
    (s.includes("english") && (paper === 1 || paper === 2)) ||
    (s.includes("kiswahili") && (paper === 1 || paper === 2))
  ) {
    return "2h30";
  }
  return "2h";
}

function msForPreset(preset: DurationPreset) {
  return preset === "2h30" ? 2.5 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000;
}
function ms30m() {
  return 30 * 60 * 1000;
}
function inMs(ms: number) {
  return new Date(Date.now() + ms);
}

/**
 * Start timing for a session:
 * - examEndsAt = now + examDuration
 * - uploadEndsAt = examEndsAt + 30m
 * - expiresAt = uploadEndsAt (legacy field still used elsewhere)
 *
 * Schedules reminders:
 *  - Halfway of EXAM window
 *  - 10 min left of EXAM window
 *  - Upload window started (immediately when exam ends)
 *  - 10 min left of UPLOAD window
 *  - Upload window ended (final)
 */
export async function startSessionTimer(
  ctx: Context,
  sessionId: string,
  opts: { subjectLabel?: string; paper?: 1 | 2 | 3; preset?: DurationPreset } = {}
) {
  const preset = opts.preset ?? resolveExamPreset(opts.subjectLabel, opts.paper);
  const examMs = msForPreset(preset);
  const uploadMs = ms30m();

  const examEndsAt = inMs(examMs);
  const uploadEndsAt = new Date(examEndsAt.getTime() + uploadMs);
  const expiresAt = uploadEndsAt;

  await SessionModel.updateOne(
    { _id: sessionId },
    {
      $set: {
        examPreset: preset,
        examEndsAt,
        uploadEndsAt,
        expiresAt, // keep legacy for anything else using it
      },
    }
  );

  // EXAM reminders
  scheduleAt(examMs / 2, () => safeReply(ctx, "⏳ Halfway! Keep going."));
  scheduleAt(Math.max(examMs - 10 * 60 * 1000, 0), () =>
    safeReply(ctx, "⚠️ 10 minutes left in the exam window.")
  );

  // Transition to UPLOAD window
  scheduleAt(examMs, async () => {
    await safeReply(ctx, "🧪 Exam window closed. ⬆️ Upload your work now — you have 30 minutes.");
  });

  // UPLOAD reminders
  scheduleAt(examMs + Math.max(uploadMs - 10 * 60 * 1000, 0), () =>
    safeReply(ctx, "⚠️ 10 minutes left to upload and finalize.")
  );

  // Final close
  scheduleAt(examMs + uploadMs, async () => {
    await safeReply(ctx, "⏰ Upload window ended. Send /finish to submit for marking.");
    // Optionally, auto-run finish if you detect uploads:
    // await tryAutoFinish(ctx);
  });
}

/**
 * Compute remaining time buckets for UI or guards.
 * Returns ms left in each window (0 if passed).
 */
export async function getTimeLeft(sessionId: string) {
  const s = await SessionModel.findById(sessionId).lean();
  const now = Date.now();
  const examLeft = Math.max(0, (s?.examEndsAt ? new Date(s.examEndsAt).getTime() : now) - now);
  const uploadLeft = Math.max(0, (s?.uploadEndsAt ? new Date(s.uploadEndsAt).getTime() : now) - now);
  return { examLeft, uploadLeft };
}

/** Convenience checks you can use in handlers */
export async function isExamOpen(sessionId: string) {
  const s = await SessionModel.findById(sessionId).lean();
  return s?.examEndsAt ? Date.now() < new Date(s.examEndsAt).getTime() : false;
}
export async function isUploadOpen(sessionId: string) {
  const s = await SessionModel.findById(sessionId).lean();
  return s?.uploadEndsAt ? Date.now() < new Date(s.uploadEndsAt).getTime() : false;
}

/** Timer helper: ensure we don't call .catch on a void */
function scheduleAt(delayMs: number, fn: () => void | Promise<void>) {
  if (delayMs <= 0) return;
  setTimeout(() => {
    Promise.resolve(fn()).catch(console.error);
  }, delayMs);
}

async function safeReply(ctx: Context, text: string) {
  try {
    await ctx.reply(text);
  } catch (e) {
    console.error("timer reply failed:", e);
  }
}
