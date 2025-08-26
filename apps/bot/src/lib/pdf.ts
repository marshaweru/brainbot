// apps/bot/src/lib/pdf.ts
import path from "path";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";

/** Unique-ish id */
function rid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Where to drop temporary PDFs (override with PDF_TMP_DIR) */
const OUT_DIR = path.resolve(
  process.env.PDF_TMP_DIR || path.join(os.tmpdir(), "brainbot_pdfs")
);

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

/** Low-level worker that turns Markdown → PDF and returns the output path */
export async function mdToPdf(markdown: string): Promise<string> {
  ensureOutDir();

  const filename = `session-${rid()}.pdf`;
  const outPath = path.join(OUT_DIR, filename);

  // Resolve worker relative to THIS compiled file
  // src/lib/pdf.ts → dist/lib/pdf.js at runtime; go up one and into pdf_worker
  const workerPath = path.resolve(__dirname, "..", "pdf_worker", "md_to_pdf.py");
  if (!fs.existsSync(workerPath)) {
    throw new Error(`PDF worker not found at: ${workerPath}`);
  }

  // Prefer python3, fall back to python (Windows)
  const pyCmd = process.platform === "win32" ? "python" : "python3";

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(pyCmd, [workerPath, outPath], {
      stdio: ["pipe", "inherit", "inherit"],
      shell: process.platform === "win32",
    });
    proc.on("error", reject);
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`pdf worker exit ${code}`))
    );
    proc.stdin.write(markdown, "utf8");
    proc.stdin.end();
  });

  return outPath;
}

/** High-level helper expected by callers */
export async function renderMarkdownToPdf(
  markdown: string,
  title: string = "BrainBot Study Pack"
): Promise<{ filePath: string; filename: string }> {
  const filePath = await mdToPdf(`# ${title}\n\n` + markdown);
  const filename = path.basename(filePath);
  return { filePath, filename };
}

/** Optional helper: best-effort delete of a temp PDF after sending */
export async function cleanupPdf(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch {
    /* ignore */
  }
}
