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

// --- helpers ---------------------------------------------------------------

const num = (n: unknown, fallback = 0): number => {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
};

const esc = (s: unknown) => html.esc(String(s ?? ""));

// --- Telegram message builder (premium-style) ------------------------------
export function buildFeedbackMessage(fb: Feedback): string {
  // Defensive copies so we don’t explode on partial data
  const subject = esc(fb?.subject);
  const paper = esc(fb?.paper);
  const totalScore = num(fb?.totalScore);
  const outOf = Math.max(1, num(fb?.outOf, 100)); // never divide by zero
  const grade = esc(fb?.grade);

  const sections: SectionScore[] = Array.isArray(fb?.sections) ? fb.sections : [];
  const weakTopics: WeakTopic[] = Array.isArray(fb?.weakTopics) ? fb.weakTopics : [];
  const rubric: RubricRow[] = Array.isArray(fb?.rubric) ? fb.rubric : [];

  // KPIs header
  const kpis =
    `${html.kpi("Subject", subject)}\n` +
    `${html.kpi("Paper", paper)}\n` +
    `${html.kpi("Score", `${totalScore}/${outOf}`)}  ` +
    `${html.kpi("Grade", grade)}\n`;

  // Section grid
  const sectionRows =
    sections.length > 0
      ? sections.map((s) => [esc(s.section), String(num(s.score)), String(num(s.outOf))])
      : [["—", "0", String(outOf)]];
  const sectionGrid = monoGrid(["Section", "Score", "Out of"], sectionRows);

  // Weak topics
  const weak =
    weakTopics.length > 0
      ? weakTopics.map((w) => `• <b>${esc(w.topic)}:</b> ${esc(w.tip)}`).join("\n")
      : "• None — keep it up ✨";

  // Rubric grid (gracefully handle empty)
  const maxLevels = Math.max(1, ...rubric.map((r) => (Array.isArray(r.levels) ? r.levels.length : 0)));
  const rubricHeaders = ["Criterion", ...Array.from({ length: maxLevels }, (_, i) => `Level ${i + 1}`)];
  const rubricRows =
    rubric.length > 0
      ? rubric.map((r) => [esc(r.criterion), ...(r.levels || []).map((lv) => esc(lv))])
      : [["—", "—"]];

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
