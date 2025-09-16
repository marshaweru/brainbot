// apps/bot/src/pdf/export.ts
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import type { Feedback } from "../feedback/render";
import { Buffer } from "node:buffer";

export type Brand = {
  bg: string;
  card: string;
  text: string;
  muted: string;
  primary: string;
  accent: string;
  success: string;
  danger: string;
};

export const BRAND: Brand = {
  bg: "#0b1220",
  card: "#111827",
  text: "#e5e7eb",
  muted: "#9ca3af",
  primary: "#facc15",
  accent: "#8b5cf6",
  success: "#22c55e",
  danger: "#ef4444",
};

export async function buildPdfBuffer(
  feedback: Feedback,
  brand: Brand = BRAND
): Promise<Buffer> {
  const html = template(feedback, brand);

  // Resolve Chromium path (env overrides package path if provided)
  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH || (await chromium.executablePath());

  const browser = await puppeteer.launch({
    executablePath,
    args: chromium.args,          // safe defaults for serverless/Render
    // headless/defaultViewport not referenced from chromium types → omit here
    headless: true,               // explicit boolean keeps TS happy
  });

  let page: Awaited<ReturnType<typeof browser.newPage>> | null = null;
  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1520, deviceScaleFactor: 2 });
    await page.emulateMediaType("screen");
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60_000 });

    const pdfBytes = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "16mm", bottom: "20mm", left: "16mm" },
      preferCSSPageSize: true,
    });

    return Buffer.isBuffer(pdfBytes) ? pdfBytes : Buffer.from(pdfBytes);
  } finally {
    try { await page?.close(); } catch {}
    await browser.close();
  }
}

function template(fb: Feedback, c: Brand): string {
  const sections = Array.isArray(fb.sections) ? fb.sections : [];
  const weak = Array.isArray(fb.weakTopics) ? fb.weakTopics : [];
  const rubric = Array.isArray(fb.rubric) ? fb.rubric : [];

  const sectionRows = sections
    .map(
      (s) => `
      <tr>
        <td>${esc(s.section || "")}</td>
        <td class="num">${num(s.score)}</td>
        <td class="num">${num(s.outOf)}</td>
      </tr>`
    )
    .join("");

  const weakRows =
    weak.length === 0
      ? `<li>None — keep it up ✨</li>`
      : weak.map((w) => `<li><b>${esc(w.topic || "")}:</b> ${esc(w.tip || "")}</li>`).join("");

  const rubricCols = Math.max(1, ...rubric.map((r) => (Array.isArray(r.levels) ? r.levels.length : 0)));
  const rubricHead =
    `<th>Criterion</th>` +
    Array.from({ length: rubricCols }, (_, i) => `<th>Level ${i + 1}</th>`).join("");
  const rubricRows = rubric
    .map((r) => {
      const levels = Array.isArray(r.levels) ? r.levels : [];
      const cells = levels.map((x) => `<td>${esc(String(x ?? ""))}</td>`).join("");
      return `<tr><td>${esc(r.criterion || "")}</td>${cells}</tr>`;
    })
    .join("");

  const totalScore = num(fb.totalScore);
  const outOf = num(fb.outOf);
  const grade = esc(fb.grade || "");
  const subject = esc(fb.subject || "");
  const paper = esc(fb.paper || "");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>BrainBot Feedback</title>
<style>
  :root {
    --bg: ${c.bg};
    --card: ${c.card};
    --text: ${c.text};
    --muted: ${c.muted};
    --primary: ${c.primary};
    --accent: ${c.accent};
    --success: ${c.success};
    --danger: ${c.danger};
  }
  @page { size: A4; margin: 20mm 16mm; }
  body {
    background: var(--bg);
    color: var(--text);
    font: 12px/1.45 system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji";
  }
  .card {
    background: var(--card);
    border-radius: 14px;
    padding: 18px 20px;
    box-shadow: 0 6px 30px rgba(0,0,0,.35);
    margin-bottom: 14px;
  }
  h1 { font-size: 22px; margin: 0 0 8px; }
  h2 { font-size: 16px; margin: 14px 0 8px; color: var(--primary); }
  .kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; }
  .kpi b { color: var(--muted); }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,.06); }
  th { text-align: left; color: var(--muted); font-weight: 600; }
  td.num { text-align: right; font-feature-settings: "tnum"; }
  .badge { background: rgba(250,204,21,.12); color: var(--primary); padding: 4px 8px; border-radius: 999px; display: inline-block; font-weight: 700; }
  .badge-grade { color:#fff; background: var(--accent); }
  .footer { color: var(--muted); font-size: 11px; text-align: center; margin-top: 10px; }
</style>
</head>
<body>
  <div class="card">
    <h1>📘 Examiner Feedback</h1>
    <div class="kpis">
      <div class="kpi"><b>Subject:</b> ${subject}</div>
      <div class="kpi"><b>Paper:</b> ${paper}</div>
      <div class="kpi"><b>Score:</b> <span class="badge">${totalScore}/${outOf}</span></div>
      <div class="kpi"><b>Grade:</b> <span class="badge badge-grade">${grade}</span></div>
    </div>
  </div>

  <div class="card">
    <h2>📊 Section Breakdown</h2>
    <table>
      <thead><tr><th>Section</th><th>Score</th><th>Out of</th></tr></thead>
      <tbody>${sectionRows}</tbody>
    </table>
  </div>

  <div class="card">
    <h2>🧠 Weak Topics & Tips</h2>
    <ul>${weakRows}</ul>
  </div>

  <div class="card">
    <h2>🧪 Marking Rubric</h2>
    <table>
      <thead><tr>${rubricHead}</tr></thead>
      <tbody>${rubricRows}</tbody>
    </table>
  </div>

  <div class="footer">BrainBot • KCSE Focused Exam Trainer</div>
</body>
</html>`;
}

function esc(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function num(n: unknown) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}
