// Run with: pnpm tsx tools/seed-demo-papers.ts
// @ts-nocheck

import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

const SUBJECTS = [
  "English","Kiswahili","Mathematics","Biology","Chemistry",
  "Physics","History & Government","Geography","CRE","Business Studies"
];

const ROOT = path.join(process.cwd(), "apps", "bot", "src", "content", "papers");

function slug(s: string) {
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/(^-|-$)+/g, "");
}

function makePdf(abs: string, title: string, body: string) {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(abs));
  doc.fontSize(18).text(title, { underline: true });
  doc.moveDown();
  doc.fontSize(12).text(body);
  // 6 demo questions
  for (let i = 1; i <= 6; i++) {
    doc.moveDown().fontSize(14).text(`Q${i}.`, { continued: true })
       .fontSize(12).text(`  KCSE-style demo question ${i}. Show working where applicable.`);
  }
  doc.end();
}

for (const s of SUBJECTS) {
  const subjectDir = path.join(ROOT, slug(s));
  // Seed just "2024-paper1.pdf" to start
  const out = path.join(subjectDir, "2024-paper1.pdf");
  if (!fs.existsSync(out)) {
    makePdf(
      out,
      `${s}: Demo KCSE-Style Paper 1 (2024)`,
      "This is a BrainBot demo paper for end-to-end testing while official KNEC content is being arranged."
    );
    console.log("✔ seeded:", out);
  } else {
    console.log("• exists:", out);
  }
}
console.log("Done.");
