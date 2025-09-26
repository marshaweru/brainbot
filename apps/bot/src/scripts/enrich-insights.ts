// apps/bot/src/scripts/enrich-insights.ts
// Usage:
//   pnpm ts-node apps/bot/src/scripts/enrich-insights.ts ./syllabus.json
//   pnpm ts-node apps/bot/src/scripts/enrich-insights.ts ./syllabus.csv --source=ai --quality=70
//
// JSON shape (array):
//   [{ "subject": "Mathematics", "topic": "Quadratic equations", "tips": ["…", "…"] }, ...]
//
// CSV columns (header required):
//   subject,topic,tips
//   tips may be `;`-separated

import fs from "fs";
import path from "path";
import { upsertInsight } from "../repo/insightsRepo.js";
import { connectMongo } from "../db/mongo.js";

type Row = { subject: string; topic: string; tips?: string[] };

function parseArgs() {
  const file = process.argv[2];
  if (!file) {
    console.error("Provide syllabus file path (.json or .csv).");
    process.exit(1);
  }
  const source = (process.argv.find(a => a.startsWith("--source="))?.split("=")[1] ?? "batch") as string;
  const quality = Number(process.argv.find(a => a.startsWith("--quality="))?.split("=")[1] ?? "50");
  return { file, source, quality };
}

function parseJSON(abs: string): Row[] {
  const data = JSON.parse(fs.readFileSync(abs, "utf8"));
  if (!Array.isArray(data)) throw new Error("JSON root must be an array");
  return data.map((r: any) => ({
    subject: String(r.subject ?? "").trim(),
    topic: String(r.topic ?? "").trim(),
    tips: Array.isArray(r.tips) ? r.tips.map(String).filter(Boolean) : undefined,
  }));
}

function parseCSV(abs: string): Row[] {
  const raw = fs.readFileSync(abs, "utf8").replace(/\r/g, "");
  const [header, ...rows] = raw.split("\n").filter(Boolean);
  const cols = header.split(",").map(s => s.trim().toLowerCase());
  const cSub = cols.indexOf("subject");
  const cTop = cols.indexOf("topic");
  const cTips = cols.indexOf("tips");
  if (cSub < 0 || cTop < 0) throw new Error("CSV must have headers: subject,topic[,tips]");
  return rows.map(line => {
    const parts = line.split(","); // simple CSV, no quoted commas
    const subject = (parts[cSub] ?? "").trim();
    const topic = (parts[cTop] ?? "").trim();
    const tipsStr = cTips >= 0 ? (parts[cTips] ?? "").trim() : "";
    const tips = tipsStr ? tipsStr.split(";").map(s => s.trim()).filter(Boolean) : undefined;
    return { subject, topic, tips };
  });
}

function fallbackTips(subject: string, topic: string): string[] {
  return [
    `In ${subject}, candidates often drop marks in ${topic} due to skipped steps.`,
    `Revise KNEC marking keywords for ${topic}.`,
    "Show all your working clearly.",
    "Check units and conversions carefully.",
  ];
}

(async () => {
  const { file, source, quality } = parseArgs();
  const abs = path.resolve(process.cwd(), file);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);

  const rows: Row[] = abs.endsWith(".json") ? parseJSON(abs)
                : abs.endsWith(".csv") ? parseCSV(abs)
                : (() => { throw new Error("Only .json or .csv supported"); })();

  await connectMongo();

  let ok = 0, fail = 0;
  for (const r of rows) {
    const subject = (r.subject || "").trim();
    const topic = (r.topic || "").trim();
    if (!subject || !topic) { fail++; continue; }
    const tips = (r.tips && r.tips.length ? r.tips : fallbackTips(subject, topic)).slice(0, 10);
    try {
      await upsertInsight({ subject, topic, tips, source, quality });
      ok++;
      if (ok % 50 === 0) console.log(`Upserted ${ok}…`);
    } catch (e) {
      console.warn("Upsert failed:", subject, topic, e);
      fail++;
    }
  }
  console.log(`Done. Success: ${ok}, Failed: ${fail}`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
