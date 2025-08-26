// apps/bot/src/lib/session.ts
import { SYSTEM_PROMPT } from "../prompts/system";
import { callGpt } from "./openai";
import { SESSION_BUDGET } from "../utils/tokenBudget";
import { subjectType, QUICK_WINS } from "../utils/subjects";

export interface SessionRequest {
  subject: string;                 // e.g., "Mathematics", "English", "Kiswahili"
  mode: "quick" | "weak" | "drill";
  level?: string;                  // optional: Form level / target grade etc.
  topic?: string;                  // optional: caller-provided topic focus
}

/* ---------------- helpers ---------------- */

function rid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function fallbackSession(subject: string) {
  const s = subject?.trim() || "General Studies";
  return (
    `# ${s}: Quick Session\n\n` +
    `## Quick Notes\n` +
    `- Key idea 1\n- Key idea 2\n- Key idea 3\n\n` +
    `**Common traps**\n- Trap 1\n- Trap 2\n\n` +
    `**Must-know**\n- Formula/definition (if any)\n\n` +
    `## Mini-Quiz (KCSE-style)\n1) …\n2) …\n3) …\n\n` +
    `_Answer here or tap “Mark My Work”._`
  );
}

function languageNudgeFor(subject: string): string | null {
  const s = subject.toLowerCase();
  if (s.includes("kiswahili")) return "Use Kiswahili for explanations, examples, and questions.";
  if (s.includes("english")) return "Use clear, KCSE-style English throughout.";
  if (s.includes("french")) return "Use French in examples/vocabulary; brief instructions can be in English.";
  if (s.includes("german")) return "Use German in examples/vocabulary; brief instructions can be in English.";
  if (s.includes("arabic")) return "Use Arabic script where appropriate; brief instructions can be in English.";
  return null;
}

function ensureStructure(content: string, subject: string): string {
  const hasNotes = /quick notes|notes/i.test(content);
  const hasQuiz = /mini[-\s]?quiz|quiz/i.test(content);
  if (hasNotes && hasQuiz) return content;

  // Append a minimal quiz if missing
  let out = content.trim();
  if (!hasQuiz) {
    out += `\n\n## Mini-Quiz (KCSE-style)\n1) …\n2) …\n3) …`;
  }
  if (!hasNotes) {
    out = `# ${subject}: Quick Session\n\n## Quick Notes\n- Key idea 1\n- Key idea 2\n\n` + out;
  }
  return out;
}

/* ---------------- main ---------------- */

export async function generateSession(req: SessionRequest) {
  const subject = (req.subject || "").trim() || "General Studies";
  const sType = subjectType(subject);
  const maxTokens =
    sType === "language" ? SESSION_BUDGET.LANGUAGE_MAX : SESSION_BUDGET.NORMAL_MAX;

  // Slightly cooler for drills; wrapper handles GPT-5 vs non-GPT-5
  const temperature = req.mode === "drill" ? 0.4 : 0.6;

  // System text with guard
  const sysText =
    (SYSTEM_PROMPT && SYSTEM_PROMPT.trim().length
      ? SYSTEM_PROMPT.trim()
      : "You are BrainBot, a KCSE study assistant. Be concise, KCSE-aligned, and practical.") +
    `\n(Session budget available to toolchain. Session ID: ${rid()})`;

  const topicHint =
    (req.topic && req.topic.trim()) ||
    QUICK_WINS[subject] ||
    "a high-frequency topic for this subject";

  const langNudge = languageNudgeFor(subject);

  const userLines = [
    `Generate a KCSE study session now.`,
    `Subject: ${subject}`,
    `Mode: ${req.mode} (quick=high-frequency, weak=common mistakes coaching, drill=past-paper mini set).`,
    req.level ? `Level: ${req.level}` : ``,
    req.mode === "quick" ? `If you need a topic, prefer: ${topicHint}.` : ``,
    langNudge ? `Language note: ${langNudge}` : ``,
    ``,
    `# OUTPUT STRUCTURE`,
    `1) Title line with subject & topic`,
    `2) "Quick Notes" section (3–7 bullets)`,
    `3) "Common traps" (2–4 bullets)`,
    `4) "Must-know" formula/definition if relevant`,
    `5) "Mini-Quiz (KCSE-style)" with 3–6 items`,
    `- Keep it exam-grade and tight. No full answer key unless asked.`,
  ]
    .filter(Boolean)
    .join("\n")
    .trim();

  try {
    const content = await callGpt(
      [
        { role: "system", content: sysText } as any,
        { role: "user", content: userLines } as any,
      ],
      sType === "language" ? "SESSION_LANGUAGE" : "SESSION_NORMAL",
      maxTokens,
      temperature
    );

    const clean = ensureStructure((content || "").trim(), subject);
    return { content: clean, subjectType: sType };
  } catch (e: any) {
    console.error("[session] generateSession error:", e?.message || e);
    return { content: fallbackSession(subject), subjectType: sType };
  }
}
