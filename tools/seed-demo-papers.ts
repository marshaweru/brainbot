// Run with: pnpm tsx tools/seed-demo-papers.ts [--force] [--year=2025]

import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

const SUBJECTS = [
  "English",
  "Kiswahili",
  "Mathematics",
  "Biology",
  "Chemistry",
  "Physics",
  "History & Government",
  "Geography",
  "CRE",
  "Business Studies",
];

const ROOT = path.join(process.cwd(), "apps", "bot", "src", "content", "papers");

const ARGV = process.argv.slice(2);
const FORCE = ARGV.includes("--force");

// Parse --year=YYYY (default: current year)
const yearFlag = ARGV.find((a) => a.startsWith("--year="));
const YEAR = yearFlag ? parseInt(yearFlag.split("=")[1], 10) : new Date().getFullYear();

/** Generate a filesystem-safe slug. */
function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/(^-|-$)+/g, "");
}

/** Generate a PDF with demo questions. */
function makePdf(absPath: string, title: string, body: string) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(absPath));

  // Title
  doc.fontSize(18).text(title, { underline: true });
  doc.moveDown();

  // Intro text
  doc.fontSize(12).text(body);
  doc.moveDown();

  // Demo questions
  for (let i = 1; i <= 6; i++) {
    doc
      .fontSize(14)
      .text(`Q${i}.`, { continued: true })
      .fontSize(12)
      .text(` KCSE-style demo question ${i}. Show working where applicable.`);
    doc.moveDown();
  }

  doc.end();
}

/** Main seeding loop. */
function main() {
  for (const subject of SUBJECTS) {
    const subjectDir = path.join(ROOT, slug(subject));

    for (let paper = 1; paper <= 3; paper++) {
      const outFile = path.join(subjectDir, `${YEAR}-paper${paper}.pdf`);

      if (FORCE || !fs.existsSync(outFile)) {
        makePdf(
          outFile,
          `${subject}: Demo KCSE-Style Paper ${paper} (${YEAR})`,
          `This is a BrainBot demo Paper ${paper} for end-to-end testing (${YEAR}) while official KNEC content is being arranged.`
        );
        console.log(`${FORCE ? "♻️  Regenerated" : "✔ Seeded"}: ${outFile}`);
      } else {
        console.log("• Exists (skipped):", outFile);
      }
    }
  }
  console.log("✅ Done seeding demo papers.");
}

main();
