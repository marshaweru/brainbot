import path from "path";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";

/** Unique-ish id */
function rid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Where to drop PDFs (pref: PDF_OUT_DIR → PDF_TMP_DIR → OS tmp) */
const OUT_DIR = path.resolve(
  process.env.PDF_OUT_DIR ||
    process.env.PDF_TMP_DIR ||
    path.join(os.tmpdir(), "brainbot_pdfs")
);

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}
export function getPdfOutDir() {
  ensureOutDir();
  return OUT_DIR;
}

function splitCmd(s: string) {
  const m = s.trim().match(/^(\S+)(?:\s+(.+))?$/);
  return { cmd: m?.[1] || s, args: m?.[2]?.split(/\s+/) ?? [] };
}

async function detectPython(): Promise<{ cmd: string; args: string[]; note: string }> {
  const envPref = (process.env.PYTHON_BIN || "").trim();
  const cands = envPref
    ? [envPref]
    : process.platform === "win32"
    ? ["py -3", "py", "python", "python3"]
    : ["python3", "python"];

  for (const c of cands) {
    const { cmd, args } = splitCmd(c);
    try {
      await new Promise<void>((res, rej) => {
        const p = spawn(cmd, [...args, "--version"], { stdio: "ignore", shell: false });
        p.on("error", rej);
        p.on("close", (code) => (code === 0 ? res() : rej(new Error(String(code)))));
      });
      return { cmd, args, note: envPref ? "env:PYTHON_BIN" : "auto" };
    } catch { /* try next */ }
  }
  return {
    cmd: process.platform === "win32" ? "python" : "python3",
    args: [],
    note: "fallback",
  };
}

/** Try dist/pdf_worker, src/pdf_worker, and repo root apps/bot/pdf_worker */
function resolveWorkerPath(): string {
  const a = path.resolve(__dirname, "..", "pdf_worker", "md_to_pdf.py");         // dist/lib → dist/pdf_worker
  const b = path.resolve(__dirname, "../pdf_worker/md_to_pdf.py");               // ts-node from src
  const c = path.resolve(process.cwd(), "apps", "bot", "pdf_worker", "md_to_pdf.py"); // repo root
  for (const p of [a, b, c]) if (fs.existsSync(p)) return p;
  return a; // best-guess for error message
}

type RenderOpts = {
  timeoutMs?: number;    // kill worker if it hangs (default 35s)
  pythonBin?: string;    // override detection for one call
};

export async function mdToPdf(markdown: string, opts: RenderOpts = {}): Promise<string> {
  ensureOutDir();

  const filename = `session-${rid()}.pdf`;
  const outPath = path.join(OUT_DIR, filename);
  const workerPath = resolveWorkerPath();
  if (!fs.existsSync(workerPath)) {
    throw new Error(`PDF worker not found at: ${workerPath}`);
  }

  const py = opts.pythonBin
    ? (() => {
        const { cmd, args } = splitCmd(opts.pythonBin!);
        return { cmd, args, note: "call:pythonBin" };
      })()
    : await detectPython();

  const stderrBuf: string[] = [];
  const stdoutBuf: string[] = [];
  const timeoutMs = Math.max(3_000, Number(opts.timeoutMs ?? 35_000));

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(py.cmd, [...py.args, workerPath, outPath], {
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
    });

    const t = setTimeout(() => {
      try { proc.kill("SIGKILL"); } catch {}
      reject(new Error(`pdf worker timeout after ${timeoutMs}ms (python=${[py.cmd, ...py.args].join(" ")})`));
    }, timeoutMs);

    proc.stderr.on("data", (d) => stderrBuf.push(String(d)));
    proc.stdout.on("data", (d) => stdoutBuf.push(String(d)));

    proc.on("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
    proc.on("close", (code) => {
      clearTimeout(t);
      if (code === 0) return resolve();
      const err = [
        `pdf worker exited ${code}`,
        `python: ${[py.cmd, ...py.args].join(" ")} (${py.note})`,
        `worker: ${workerPath}`,
        `out: ${outPath}`,
        stderrBuf.length ? `stderr:\n${stderrBuf.join("")}` : "",
        stdoutBuf.length ? `stdout:\n${stdoutBuf.join("")}` : "",
      ].filter(Boolean).join("\n");
      reject(new Error(err));
    });

    proc.stdin.write(markdown, "utf8");
    proc.stdin.end();
  });

  return outPath;
}

export async function renderMarkdownToPdf(
  markdown: string,
  title: string = "BrainBot Study Pack",
  opts?: RenderOpts
): Promise<{ filePath: string; filename: string }> {
  const head = `# ${title}\n\n`;
  const filePath = await mdToPdf(head + markdown, opts);
  return { filePath, filename: path.basename(filePath) };
}

export async function cleanupPdf(filePath: string): Promise<void> {
  try { await fs.promises.unlink(filePath); } catch { /* ignore */ }
}
