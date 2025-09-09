// apps/bot/src/feedback/render.ts
import { html } from "../utils/format";
import { monoGrid } from "../utils/grid";

export type SectionScore = { section: string; score: number; outOf: number };
export type WeakTopic = { topic: string; tip: string };
export type RubricRow = { criterion: string; levels: string[] };

export type Feedback = {
  paper: string;
  subject: string;
  totalScore: number;
  outOf: number;
  grade: string;
  sections: SectionScore[];
  weakTopics: WeakTopic[];
  rubric: RubricRow[];
};

// --- Telegram message builder (premium-style) ---
export function buildFeedbackMessage(fb: Feedback): string {
  const kpis =
    `${html.kpi("Subject", html.esc(fb.subject))}\n` +
    `${html.kpi("Paper", html.esc(fb.paper))}\n` +
    `${html.kpi("Score", `${fb.totalScore}/${fb.outOf}`)}  ` +
    `${html.kpi("Grade", fb.grade)}\n`;

  const sectionGrid = monoGrid(
    ["Section", "Score", "Out of"],
    fb.sections.map((s) => [s.section, s.score, s.outOf])
  );

  const weak =
    fb.weakTopics.length > 0
      ? fb.weakTopics
          .map((w) => `• <b>${html.esc(w.topic)}:</b> ${html.esc(w.tip)}`)
          .join("\n")
      : "• None — keep it up ✨";

  const rubricHeaders = [
    "Criterion",
    "Level 1",
    "Level 2",
    "Level 3",
    "Level 4",
  ].slice(0, 1 + Math.max(1, ...fb.rubric.map((r) => r.levels.length)));
  const rubricRows = fb.rubric.map((r) => [r.criterion, ...r.levels]);
  const rubricGrid = monoGrid(rubricHeaders, rubricRows);

  return (
    `${html.h1("📘 Examiner Feedback")}\n\n` +
    `${kpis}\n` +
    `${html.h2("📊 Section Breakdown")}\n` +
    `${html.pre(sectionGrid)}\n\n` +
    `${html.h2("🧠 Weak Topics & Tips")}\n` +
    `${weak}\n\n` +
    `${html.h2("🧪 Marking Rubric")}\n` +
    `${html.pre(rubricGrid)}\n\n` +
    `➕ <b>Next:</b> Use <code>/drill</code> to practice weak topics, or <code>/pdf</code> for the full report.`
  );
}
