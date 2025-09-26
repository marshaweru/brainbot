// apps/bot/src/utils/render-feedback.ts
import { html } from "./format.js";

export type FeedbackInput = {
  subject: string;
  topic?: string | null;

  // Scoring
  marksAwarded: number;
  marksTotal: number;

  // Optional timing
  timeSpentSec?: number;     // actual
  idealTimeSec?: number;     // target

  // Insights
  strengths?: Array<{ area: string; evidence?: string }>;
  weaknesses?: Array<{ area: string; fix?: string; evidence?: string }>;
  misconceptions?: Array<{ topic: string; note: string }>;
  tips?: string[];

  // Next actions
  drills?: Array<{ topic: string; count: number; difficulty?: string }>;
  resources?: Array<{ label: string; url: string }>;
};

function fmtMin(sec?: number): string | null {
  if (!sec || sec <= 0) return null;
  const m = Math.round(sec / 60);
  return `${m} min`;
}

function pct(a: number, t: number): string {
  if (!Number.isFinite(a) || !Number.isFinite(t) || t <= 0) return "—";
  return `${Math.round((a / t) * 100)}%`;
}

function clampTelegram(s: string, max = 3900): string {
  // TG limit is 4096 chars; leave headroom for safety
  if (s.length <= max) return s;
  return s.slice(0, max - 10) + "…";
}

export function renderFeedback(fb: FeedbackInput): string {
  const lines: string[] = [];

  const title = fb.topic
    ? `${fb.subject} • ${fb.topic}`
    : fb.subject;

  lines.push(html.h1(`Exam Feedback — ${title}`));
  lines.push(
    html.kpi("Score", `${fb.marksAwarded}/${fb.marksTotal} (${pct(fb.marksAwarded, fb.marksTotal)})`)
  );

  const spent = fmtMin(fb.timeSpentSec);
  const ideal = fmtMin(fb.idealTimeSec);
  if (spent || ideal) {
    const tbits = [
      spent ? `Spent: ${spent}` : null,
      ideal ? `Target: ${ideal}` : null,
    ].filter(Boolean);
    lines.push(html.kpi("Timing", tbits.join(" • ")));
  }

  // Strengths
  if (fb.strengths?.length) {
    lines.push("");
    lines.push(html.h2("✅ Strengths"));
    for (const s of fb.strengths.slice(0, 6)) {
      const msg = s.evidence ? `${s.area} — ${s.evidence}` : s.area;
      lines.push(html.li(msg));
    }
  }

  // Weaknesses
  if (fb.weaknesses?.length) {
    lines.push("");
    lines.push(html.h2("⚠️ Weaknesses"));
    for (const w of fb.weaknesses.slice(0, 6)) {
      const msg = [w.area, w.evidence].filter(Boolean).join(" — ");
      lines.push(html.li(msg || w.area));
      if (w.fix) lines.push(html.i(`   ↳ Fix: ${w.fix}`));
    }
  }

  // Misconceptions
  if (fb.misconceptions?.length) {
    lines.push("");
    lines.push(html.h2("🌀 Misconceptions"));
    for (const m of fb.misconceptions.slice(0, 5)) {
      lines.push(html.li(`${m.topic}: ${m.note}`));
    }
  }

  // Tips (short actionable)
  if (fb.tips?.length) {
    lines.push("");
    lines.push(html.h2("🧠 Examiner Tips"));
    for (const t of fb.tips.slice(0, 6)) {
      lines.push(html.li(t));
    }
  }

  // Next actions
  const hasDrills = fb.drills && fb.drills.length > 0;
  const hasRes = fb.resources && fb.resources.length > 0;
  if (hasDrills || hasRes) {
    lines.push("");
    lines.push(html.h2("➡️ What to do next"));
    if (hasDrills) {
      const brief = fb.drills!
        .slice(0, 4)
        .map((d) => `${d.topic} ×${d.count}${d.difficulty ? ` (${d.difficulty})` : ""}`)
        .join(" • ");
      lines.push(html.li(`Drills: ${brief}`));
    }
    if (hasRes) {
      for (const r of fb.resources!.slice(0, 3)) {
        lines.push(html.li(html.link(r.label, r.url)));
      }
    }
  }

  // Closing line
  lines.push("");
  lines.push(html.i("Remember: method marks are real money. Show steps, label units, win marks."));

  return clampTelegram(lines.join("\n"));
}
