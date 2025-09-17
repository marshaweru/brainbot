// apps/bot/src/image/report-card.ts
import puppeteer from "puppeteer";
import type { Feedback } from "../feedback/render";
import { BRAND, type Brand } from "../pdf/export";

export async function buildReportCardPng(
  fb: Feedback,
  brand: Brand = BRAND
): Promise<Buffer> {
  const html = template(fb, brand);

  const browser = await puppeteer.launch({
    // args: ["--no-sandbox", "--disable-setuid-sandbox"], // enable on some hosts
    defaultViewport: { width: 800, height: 1200, deviceScaleFactor: 2 },
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const png = await page.screenshot({ type: "png" }) as Buffer;
  await browser.close();
  return png;
}

function template(fb: Feedback, c: Brand): string {
  const pct = Math.round((fb.totalScore / Math.max(1, fb.outOf)) * 100);

  const topWeak =
    (fb.weakTopics?.slice(0, 3) ?? []).map(
      (w) => `<div class="chip">• ${esc(w.topic)}</div>`
    ).join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>BrainBot Report Card</title>
<style>
  :root {
    --bg: ${c.bg};
    --card: ${c.card};
    --text: ${c.text};
    --muted: ${c.muted};
    --primary: ${c.primary}; /* yellow */
    --accent: ${c.accent};   /* purple */
    --success: ${c.success};
    --danger: ${c.danger};
  }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; width:100%; height:100%; background: var(--bg); }
  body { font: 16px/1.45 Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: var(--text); display:flex; align-items:center; justify-content:center; }
  .wrap {
    width: 760px; height: 1160px; background: radial-gradient(1000px 700px at 10% 0%, rgba(139,92,246,.15), transparent 50%), var(--card);
    border-radius: 28px; box-shadow: 0 20px 80px rgba(0,0,0,.45);
    padding: 28px 28px 22px; position: relative; overflow: hidden;
  }
  .brand {
    position:absolute; top:18px; right:18px; color: var(--muted); font-weight:600; letter-spacing:.3px;
    background: rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); padding: 6px 10px; border-radius: 999px;
  }
  h1 { margin: 6px 0 2px; font-size: 28px; }
  .sub { color: var(--muted); font-size: 14px; margin-bottom: 12px; }

  .kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; margin-top: 14px; }
  .k { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.06); border-radius: 16px; padding: 12px 14px; }
  .k label { display:block; color: var(--muted); font-size: 12px; }
  .k strong { font-size: 20px; }

  .score {
    margin: 16px 0 10px; background: linear-gradient(135deg, rgba(250,204,21,.12), rgba(139,92,246,.12));
    border: 1px solid rgba(255,255,255,.08); border-radius: 18px; padding: 14px 16px; display:flex; align-items:center; gap: 14px;
  }
  .score .ring {
    width: 90px; height: 90px; border-radius: 999px; background:
      conic-gradient(var(--primary) ${pct}%, rgba(255,255,255,.12) ${pct}% 100%);
    position: relative; display:flex; align-items:center; justify-content:center;
  }
  .score .ring::after {
    content: ""; position:absolute; width: 72px; height:72px; border-radius:999px; background: var(--card);
  }
  .score .ring span {
    position:absolute; font-weight:800; font-size: 18px; color: var(--primary);
  }
  .score .text { font-size: 14px; color: var(--muted); }
  .score .big { font-size: 28px; font-weight: 800; color: #fff; }

  .panel {
    background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.06);
    border-radius: 18px; padding: 14px 16px; margin-top: 12px;
  }
  .panel h2 { margin: 0 0 10px; font-size: 16px; color: var(--primary); }

  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,.06); }
  th { text-align: left; color: var(--muted); font-weight: 600; }
  td.num { text-align: right; font-feature-settings: "tnum"; }

  .chips { display:flex; gap:8px; flex-wrap:wrap; }
  .chip { background: rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); padding:6px 10px; border-radius: 999px; }

  .footer {
    position:absolute; left:0; right:0; bottom:0; color: var(--muted);
    text-align:center; padding: 10px 16px 14px; font-size: 13px;
    border-top: 1px solid rgba(255,255,255,.06);
    background: linear-gradient(180deg, transparent, rgba(0,0,0,.15));
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="brand">BrainBot</div>
    <h1>📘 Report Card</h1>
    <div class="sub">KCSE Focused Exam Trainer</div>

    <div class="score">
      <div class="ring"><span>${pct}%</span></div>
      <div>
        <div class="big">${fb.totalScore}/${fb.outOf} • ${esc(fb.grade)}</div>
        <div class="text">${esc(fb.subject)} — ${esc(fb.paper)}</div>
      </div>
    </div>

    <div class="kpis">
      <div class="k"><label>Subject</label><strong>${esc(fb.subject)}</strong></div>
      <div class="k"><label>Paper</label><strong>${esc(fb.paper)}</strong></div>
      <div class="k"><label>Best Section</label><strong>${bestSection(fb)}</strong></div>
      <div class="k"><label>Needs Work</label><strong>${needsWork(fb)}</strong></div>
    </div>

    <div class="panel">
      <h2>📊 Section Breakdown</h2>
      <table>
        <thead><tr><th>Section</th><th>Score</th><th class="num">Out of</th></tr></thead>
        <tbody>
          ${fb.sections.map(s => `<tr><td>${esc(s.section)}</td><td>${s.score}</td><td class="num">${s.outOf}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>

    <div class="panel">
      <h2>🧠 Top Weak Topics</h2>
      <div class="chips">${topWeak || '<div class="chip">None — keep it up ✨</div>'}</div>
    </div>

    <div class="footer">Share your progress and keep training daily • brainbot.africa</div>
  </div>
</body>
</html>`;
}

function bestSection(fb: { sections: { section: string; score: number }[] }) {
  const s = [...fb.sections].sort((a, b) => b.score - a.score)[0];
  return s ? `${s.section} (${s.score})` : "-";
}
function needsWork(fb: { sections: { section: string; score: number }[] }) {
  const s = [...fb.sections].sort((a, b) => a.score - b.score)[0];
  return s ? `${s.section} (${s.score})` : "-";
}
function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
