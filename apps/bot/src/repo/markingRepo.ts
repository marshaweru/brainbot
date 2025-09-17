// apps/bot/src/repo/markingRepo.ts
import { SessionModel } from "../models/Session.js";
import { PerformanceModel } from "../models/Performance.js";
import { handleMarking } from "../marking.js";            // your pipeline entry
import { toFeedback } from "../feedback/adapter.js";      // your normalizer
import { postSession } from "../services/postSession.js"; // HMAC → web /api/session-complete
import { listUploadsBySession } from "./sessionRepo.js";
import { upsertLatestFeedback } from "../repo/feedbackRepo.js";


type Plan = "free" | "lite" | "steady" | "serious" | "elite";

type MarkParams =
  | { sessionId: string; subjectLabel: string; telegramId?: string | number }
  | { telegramId: string | number; subjectLabel?: string; sessionId?: undefined };

/** Numeric → letter helper (tweak thresholds if you have a canonical map elsewhere). */
function numericToLetter(n?: number): string | undefined {
  if (typeof n !== "number") return undefined;
  if (n >= 80) return "A";
  if (n >= 75) return "A-";
  if (n >= 70) return "B+";
  if (n >= 65) return "B";
  if (n >= 60) return "B-";
  if (n >= 55) return "C+";
  if (n >= 50) return "C";
  if (n >= 45) return "C-";
  if (n >= 40) return "D+";
  if (n >= 35) return "D";
  if (n >= 30) return "D-";
  return "E";
}

/**
 * Core marker: can mark by explicit sessionId (past or present) OR the current active session by telegramId.
 * - Runs your marking pipeline
 * - Normalizes feedback
 * - Saves a Performance row
 * - Upserts the durable "latest feedback" snapshot (for PDF export)
 * - Posts a session summary to the web via HMAC webhook
 *
 * NOTE: It **does not** close the session; your /finish handler should do that to avoid double-closing.
 */
export async function markSessionAndSummarize(params: MarkParams) {
  // 1) Locate the session + uploads
  let session: any = null;
  let uploads: any[] = [];
  let telegramIdStr: string;

  if ("sessionId" in params) {
    session = await SessionModel.findById(params.sessionId).lean();
    if (!session) throw new Error(`Session not found: ${params.sessionId}`);
    uploads = await listUploadsBySession(String(session._id));
    if (!uploads.length) throw new Error("No uploads found for this session.");
    telegramIdStr = String(session.telegramId);
  } else {
    telegramIdStr = String(params.telegramId);
    session = await SessionModel.findOne({
      telegramId: telegramIdStr,
      active: true,
      expiresAt: { $gt: new Date() },
    }).lean();
    if (!session) throw new Error("No active session.");
    uploads = session.uploads ?? [];
    if (!uploads.length) {
      throw new Error("No uploads found. Send photos/voice/PDF/text answers first.");
    }
  }

  const subjectLabel =
    ("subjectLabel" in params && params.subjectLabel) ||
    session.subjectLabel ||
    "General";

  const paperNum: 1 | 2 | 3 = ([1, 2, 3] as const).includes(session.paper as any)
    ? (session.paper as 1 | 2 | 3)
    : 1;

  const plan: Plan = (session.plan as Plan) || "free";

  // 2) Run marking pipeline
  const raw: any = await handleMarking(uploads as any, subjectLabel);
  const feedback: any = await toFeedback(raw); // expect fields like score/totalScore/outOf, weakTopics, remarks...

  // Normalize grading
  const total = Number(
    feedback?.totalScore ?? feedback?.score ?? 0
  );
  const outOf = Number(feedback?.outOf ?? 100);
  const gradeNumeric =
    outOf > 0 ? Math.round((total / outOf) * 100) : Number(feedback?.score ?? 0);
  const gradeText = String(feedback?.grade ?? numericToLetter(gradeNumeric) ?? "");

  // Normalize weak topics → string[]
  const weakTopics: string[] = Array.isArray(feedback?.weakTopics)
    ? feedback.weakTopics.map((w: any) => {
        if (typeof w === "string") return w;
        return String(w?.topic ?? "").trim();
      }).filter(Boolean)
    : [];

  // 3) Persist Performance (YOUR schema)
  const perfDoc = await PerformanceModel.create({
    telegramId: telegramIdStr,
    subjectLabel,
    gradeNumeric,
    gradeText,
    weakTopics,
    feedback,      // normalized object
    raw,           // raw pipeline output (handy for audits)
  });

  // 4) Upsert "latest feedback" snapshot for PDF export & resilience
  const startedAtISO: string =
    (session.startedAt instanceof Date
      ? session.startedAt.toISOString()
      : session.startedAt) || new Date().toISOString();
  const finishedAtISO = new Date().toISOString();

  await upsertLatestFeedback({
    telegramId: telegramIdStr,
    subjectLabel,
    gradeNumeric,
    gradeText,
    weakTopics,
    remarks: feedback?.remarks || "",
    startedAt: startedAtISO,
    finishedAt: finishedAtISO,
    plan,
    feedback,
  });

  // 5) Post to web dashboard (HMAC → /api/session-complete)
  try {
    await postSession({
      telegramId: Number(telegramIdStr),
      plan,
      subject: subjectLabel as any,
      paper: paperNum,
      score: gradeNumeric,            // send normalized 0..100
      startedAt: startedAtISO,
      finishedAt: finishedAtISO,
      weakTopics,
      remarks: feedback?.remarks || undefined,
    });
  } catch (e) {
    // Non-fatal: analytics & snapshot are saved; web sync can retry later if you add a DLQ.
    console.error("postSession failed:", e);
  }

  return { raw, feedback, uploads, performanceId: perfDoc._id, sessionId: String(session._id) };
}

/**
 * Back-compat alias that behaves like your old function:
 * marks the **active** session for a user.
 */
export async function markActiveSessionAndSummarize(p: { telegramId: string | number; subjectLabel?: string }) {
  const telegramIdStr = String(p.telegramId);
  const active = await SessionModel.findOne({
    telegramId: telegramIdStr,
    active: true,
    expiresAt: { $gt: new Date() },
  }).lean();

  if (!active) throw new Error("No active session.");

  return markSessionAndSummarize({
    sessionId: String(active._id),
    subjectLabel: p.subjectLabel || active.subjectLabel || "General",
    telegramId: telegramIdStr, // optional; not required when sessionId is present
  });
}
