// apps/bot/src/lib/session.ts
import { chatComplete } from "./openai.js";
import {
  REVEAL_SYSTEM_PROMPT,
  buildRevealUserPrompt,
  sessionMaxTokens,
  textModelForTier,
  type TierCode,
  type SubjectSlug,
} from "../prompts/system.js";
import { chunkMarkdownV2 } from "./telegramFormat.js";

// ---------------- Types ----------------

export interface GenerateSessionOpts {
  subject: SubjectSlug;     // e.g., "mat"
  label: string;            // e.g., "Mathematics"
  topic: string;            // e.g., "Quadratics"
  tier: TierCode;           // e.g., "lite" | "pro" | "serious" | "premium"
  level?: "F1" | "F2" | "F3" | "F4";
  monthsToKCSE?: number;
}

export interface GenerateSessionResult {
  raw: string;              // raw JSON string from the model (for debugging)
  json?: any;               // parsed JSON if extraction succeeded
  content: string;          // final Markdown sent to user
  pdfMarkdown: string;      // same as content (or a slightly massaged version) for PDF
  chunksV2: string[];       // Telegram-safe MarkdownV2 chunks
}

// -------------- helpers ---------------

function extractJson(raw: string): any | undefined {
  // grab the first {...} block
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return undefined;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

function mdFromRevealJson(obj: any): string {
  if (!obj || typeof obj !== "object") return "";
  const title = obj.title || "";
  const topic = obj.topic || "";
  const paper = obj.paper || "Mixed";
  const notes = (obj.notes_md || "").trim();
  const assignment = (obj.assignment_md || "").trim();
  const extras = (obj.extras_md || "").trim();
  const plan60 = (obj.plan60_md || "").trim();

  // quiz array -> markdown
  const quizLines = Array.isArray(obj.quiz)
    ? obj.quiz
        .map(
          (q: any) =>
            `### ${q.id || "Q"} • ${q.marks ?? ""} marks\n` +
            `${(q.q_md || "").trim()}`
        )
        .join("\n\n")
    : "";

  return [
    `# ${title}`.trim(),
    topic ? `\nTopic: ${topic}\n\nPaper: ${paper}` : `Paper: ${paper}`,
    notes ? `\n\n## A. Examinable Notes\n\n${notes}` : "",
    assignment ? `\n\n## B. Notebook Assignment\n\n${assignment}` : "",
    quizLines ? `\n\n## C. KCSE-Style Questions\n\n${quizLines}` : "",
    extras ? `\n\n## D. Examiner Extras\n\n${extras}` : "",
    plan60 ? `\n\n## E. 60-Minute Plan\n\n${plan60}` : "",
  ]
    .join("")
    .trim();
}

// -------------- main -------------------

export async function generateSession(
  opts: GenerateSessionOpts
): Promise<GenerateSessionResult> {
  const model = textModelForTier(opts.tier);
  const maxTokens = sessionMaxTokens(opts.subject, opts.tier);

  // User prompt (reveal-mode JSON)
  const userPrompt = buildRevealUserPrompt({
    subject: opts.subject,
    label: opts.label,
    topic: opts.topic,
    tier: opts.tier,
    level: opts.level,
    monthsToKCSE: opts.monthsToKCSE,
  });

  // chatComplete returns RAW string (model must return JSON per REVEAL_SYSTEM_PROMPT)
  const raw: string = await chatComplete({
    model,
    maxTokens,
    messages: [
      { role: "system", content: REVEAL_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const json = extractJson(raw);
  const content = mdFromRevealJson(json) || raw.trim();
  const pdfMarkdown = content;

  // Telegram-safe chunks (MarkdownV2)
  const chunksV2 = chunkMarkdownV2(content, 3900);

  return { raw, json, content, pdfMarkdown, chunksV2 };
}
