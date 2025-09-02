// apps/bot/src/lib/telegramFormat.ts

/**
 * Telegram text helpers for MarkdownV2 rendering + grid/scorecard templates.
 * These keep BrainBot output aligned, sharable, and Gen-Z pretty.
 *
 * parse_mode: "MarkdownV2"
 */

/////////////////////////// MarkdownV2 escaping ///////////////////////////

export function escapeMarkdownV2(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/_/g, "\\_")
    .replace(/\*/g, "\\*")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/~/g, "\\~")
    .replace(/`/g, "\\`")
    .replace(/>/g, "\\>")
    .replace(/#/g, "\\#")
    .replace(/\+/g, "\\+")
    .replace(/-/g, "\\-")
    .replace(/=/g, "\\=")
    .replace(/\|/g, "\\|")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/\./g, "\\.")
    .replace(/!/g, "\\!");
}

/** Wrap text in a MarkdownV2 code block. Pass **pre-escaped** content. */
export function codeBlock(preEscaped: string): string {
  return "```\n" + preEscaped + "\n```";
}

/////////////////////////// Visual headers & bullets //////////////////////

export function header(title: string): string {
  return `*${escapeMarkdownV2(title)}*`;
}
export function subHeader(title: string): string {
  return `_${escapeMarkdownV2(title)}_`;
}
export function bullet(items: string[]): string {
  return items.map(i => `• ${escapeMarkdownV2(i)}`).join("\n");
}

/////////////////////////// Table rendering (monospace) ///////////////////

/** Core raw table (no escaping). Columns padded with two spaces between. */
export function renderTableRaw(headers: string[], rows: string[][]): string {
  const all = [headers, ...rows];
  const widths = headers.map((_, c) => Math.max(...all.map(r => (r[c] ?? "").length)));
  const pad = (s: string, w: number) => s + " ".repeat(Math.max(0, w - s.length));
  const line = (cols: string[]) => cols.map((c, i) => pad(c, widths[i])).join("  ");
  const hdr = line(headers);
  const div = widths.map(w => "-".repeat(w)).join("  ");
  const body = rows.map(r => line(r)).join("\n");
  return [hdr, div, body].filter(Boolean).join("\n");
}

/** Safe table: escapes all cells for MarkdownV2 and wraps in a code block. */
export function renderTable(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => escapeMarkdownV2(String(v));
  const raw = renderTableRaw(headers.map(esc), rows.map(r => r.map(esc)));
  return codeBlock(raw);
}

/////////////////////////// Ready-made BrainBot grids /////////////////////

export function papersTable(): string {
  return renderTable(
    ["Paper", "Focus Area", "What It Tests"],
    [
      ["Paper 1", "Core Concepts (No calc)", "Numbers, Algebra, Geometry, Probability, Basic Stats"],
      ["Paper 2", "Applied Concepts (Calc OK)", "Trig, Vectors, Graphs, Logs, Calculus, 3D, Transformations"],
    ]
  );
}

export function topicsTable(rows: Array<{ no: number|string; topic: string; sub: string }>): string {
  return renderTable(
    ["#", "Topic", "Subtopics"],
    rows.map(r => [r.no, r.topic, r.sub])
  );
}

export function scorecard(rows: Array<{ label: string; mark: string }>): string {
  return renderTable(
    ["Section / Question", "Mark"],
    rows.map(r => [r.label, r.mark])
  );
}

export function improveTable(items: Array<{ area: string; how: string }>): string {
  return renderTable(
    ["Area", "How"],
    items.map(i => [i.area, i.how])
  );
}

export function totalBlock(label: string, value: string): string {
  const raw = renderTableRaw([label, "Value"], [[label, value]]);
  // Only keep body, not header/divider
  const lines = raw.split("\n").slice(2).join("\n");
  return codeBlock(lines);
}

/////////////////////////// High-level section builders ///////////////////

export function buildBreakdownBlock(subjectTitle: string): string {
  const h = header(`💯 ${subjectTitle} (Revised Syllabus Breakdown)`);
  const line = escapeMarkdownV2("Final grade = Paper 1 + Paper 2 (out of 200) → converted to A–E. Aim ~80+/100 each for A plain (12 pts).");
  return `${h}\n\n${papersTable()}\n\n${line}`;
}

export function buildMarksDistribution(): string {
  const h = subHeader("📚 Question Format & Mark Distribution");
  const body = bullet([
    "Total questions: 14–16; marks: 6–10 each",
    "Structure: multi-part (a, b, c)",
    "Trend: Q1–2 Numbers/Algebra • Q3–5 Commercial/Rates • Q6–8 Geometry/Pythag • Q9–10 Circles • Q11–12 Prob/Stats • Q13–14 Area/Volume",
  ]);
  return `${h}\n${body}`;
}

export function upgradeCTA(tier: "lite"|"pro"|"serious"|"premium" = "lite"): string {
  const map = {
    lite:    "Upgrade to *Lite Pass* → 2 subjects/day • ~2h • quick boost.",
    pro:     "Go *Steady Pass* → 2 subjects/day • ~2h • weekly rhythm.",
    serious: "Level up to *Serious Prep* → 3 subjects/day • ~5h • 30-day grind.",
    premium: "Join *Club 84* → 4 subjects/day • ~8h • elite 30-day sprint.",
  } as const;
  return escapeMarkdownV2(map[tier]);
}

/////////////////////////// Session composer //////////////////////////////

/**
 * Input payload for full-session formatting.
 * All plain text fields are auto-escaped for MarkdownV2.
 * Tables/scorecards are rendered as code blocks for alignment.
 */
export interface SessionFormatPayload {
  // Header + Breakdown (ALWAYS first)
  subjectTitle: string; // e.g., "KCSE MATHEMATICS STRUCTURE"
  paperHeader: string;  // e.g., "🔢 PAPER 1 — Core Concepts (No Calculator)"
  paperFocusBullets: string[]; // 1–3 bullets under paper header
  topics: Array<{ no: number|string; topic: string; sub: string }>; // Paper topics table

  // Format & Samples
  markDistributionBullets?: string[];       // override default distribution text (optional)
  sampleQuestions?: string[];               // list of sample KCSE stems (escaped automatically)
  strategies?: string[];                    // 4–6 study pro tips
  timingBullets?: string[];                 // pacing plan bullets

  // Teaching loop
  notesTitle: string;                       // e.g., "📘 QUICK NOTES — Algebra Basics"
  notesBullets: string[];                   // 4–8 bullets
  workedExamples: Array<{ label: string; steps: string[] }>; // 2–3 examples with steps
  assignmentTasks: string[];                // 4–6 tasks
  quiz: { stem: string; marks?: number };   // one 5-mark quiz (default 5)

  // Feedback block (optional; displayed when marking happens)
  feedback?: {
    workedRows: Array<{ label: string; mark: string }>;
    quizScoreLine?: string;                 // e.g., "Quiz: 5/5"
    bestBullets?: string[];
    improveRows?: Array<{ area: string; how: string }>;
    totals?: Array<{ label: string; value: string }>;
  };

  // CTA (optional)
  ctaTier?: "lite"|"pro"|"serious"|"premium";
  ctaLineOverride?: string;
}

/** Compose full session into Telegram-ready MarkdownV2 (<=4096 chars chunks). */
export function formatSession(payload: SessionFormatPayload, chunkLimit = 3900): string[] {
  const {
    subjectTitle, paperHeader, paperFocusBullets, topics,
    markDistributionBullets, sampleQuestions, strategies, timingBullets,
    notesTitle, notesBullets, workedExamples, assignmentTasks, quiz,
    feedback, ctaTier, ctaLineOverride,
  } = payload;

  const parts: string[] = [];

  // (1) Breakdown header + papers table + grade line
  parts.push(buildBreakdownBlock(subjectTitle));

  // (2) Paper header + focus bullets
  parts.push(
    header(paperHeader),
    bullet(paperFocusBullets || [])
  );

  // (3) Topics table
  parts.push(topicsTable(topics));

  // (4) Mark distribution
  if (markDistributionBullets && markDistributionBullets.length) {
    parts.push(
      subHeader("📚 Question Format & Mark Distribution"),
      bullet(markDistributionBullets)
    );
  } else {
    parts.push(buildMarksDistribution());
  }

  // (5) Sample KCSE-style questions
  if (sampleQuestions && sampleQuestions.length) {
    parts.push(
      subHeader("📝 Sample KCSE-Style Question Types"),
      bullet(sampleQuestions)
    );
  }

  // (6) Pro strategies
  if (strategies && strategies.length) {
    parts.push(
      subHeader("🎯 Pro Strategies for Success"),
      bullet(strategies)
    );
  }

  // (7) Time allocation
  if (timingBullets && timingBullets.length) {
    parts.push(
      subHeader("⏱️ Time Allocation Guide"),
      bullet(timingBullets)
    );
  }

  // — Teaching loop —

  // (8) Quick Notes
  parts.push(
    header(notesTitle),
    bullet(notesBullets)
  );

  // (9) Worked Examples (render steps as neat lines)
  const exBlocks = workedExamples.map(ex => {
    const title = `**${escapeMarkdownV2(ex.label)}**`;
    const steps = ex.steps.map(s => `→ ${escapeMarkdownV2(s)}`).join("\n");
    return `${title}\n${steps}`;
  }).join("\n\n");
  parts.push(exBlocks);

  // (10) Assignment
  parts.push(
    header("✍️ ASSIGNMENT (For Your Book)"),
    bullet(assignmentTasks),
    escapeMarkdownV2('📸 Done? → Say **"mark my work"**')
  );

  // (11) Mini Quiz
  const quizMarks = typeof quiz.marks === "number" ? quiz.marks : 5;
  parts.push(
    header(`🧪 MINI QUIZ (KCSE Style — ${quizMarks} marks)`),
    escapeMarkdownV2(quiz.stem)
  );

  // (12–15) Feedback (optional; only when marking is triggered)
  if (feedback) {
    parts.push(header("📋 MARKING & FEEDBACK"));
    if (feedback.workedRows?.length) {
      parts.push(scorecard(feedback.workedRows));
    }
    if (feedback.quizScoreLine) {
      parts.push(subHeader(escapeMarkdownV2(feedback.quizScoreLine)));
    }
    if (feedback.totals?.length) {
      parts.push(renderTable(["Section", "Mark"], feedback.totals.map(t => [t.label, t.value])));
    }
    if (feedback.bestBullets?.length) {
      parts.push(subHeader("🧠 What You Did Best"), bullet(feedback.bestBullets));
    }
    if (feedback.improveRows?.length) {
      parts.push(subHeader("🔧 What to Improve"), improveTable(feedback.improveRows));
    }
  }

  // (16) CTA
  const cta = ctaLineOverride ?? (ctaTier ? upgradeCTA(ctaTier) : "");
  if (cta) {
    parts.push(subHeader("📌 Conclusion / CTA"), escapeMarkdownV2(cta));
  }

  // Join & chunk
  const full = parts.filter(Boolean).join("\n\n").trim();
  return chunkMarkdownV2(full, chunkLimit);
}

/**
 * Split a long MarkdownV2 message into safe chunks under Telegram's 4096 char limit.
 * Tries to split on blank lines; keeps code blocks balanced across chunks.
 */
export function chunkMarkdownV2(text: string, maxLen = 3900): string[] {
  if (text.length <= maxLen) return [text];

  const paras = text.split(/\n{2,}/g);
  const chunks: string[] = [];
  let buf = "";

  const flush = () => {
    if (!buf.trim()) return;
    // Ensure code fences are balanced in this chunk
    const fenceCount = (buf.match(/```/g) || []).length;
    if (fenceCount % 2 !== 0) {
      // close an open fence
      buf += "\n```";
    }
    chunks.push(buf.trim());
    buf = "";
  };

  for (const p of paras) {
    const next = buf ? `${buf}\n\n${p}` : p;
    if (next.length > maxLen) {
      // if the paragraph itself is too big, hard-slice it safely
      if (!buf) {
        // slice the huge paragraph
        let start = 0;
        while (start < p.length) {
          const slice = p.slice(start, start + maxLen - 10);
          buf = slice;
          flush();
          start += slice.length;
        }
      } else {
        flush();
        buf = p;
        if (buf.length > maxLen) {
          // slice residual huge paragraph
          let start = 0;
          while (start < buf.length) {
            const slice = buf.slice(start, start + maxLen - 10);
            const tmp = slice;
            buf = tmp;
            flush();
            start += slice.length;
          }
          buf = "";
        }
      }
    } else {
      buf = next;
    }
  }
  flush();
  return chunks;
}
