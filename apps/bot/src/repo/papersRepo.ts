// apps/bot/src/repo/papersRepo.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { PaperMeta, KCSESubject } from "../models/Paper.js";

/**
 * Directory layout (Phase 1+):
 *   - PDFs:  apps/bot/src/content/papers/<subject>/*.pdf
 *            e.g. math/2021-paper1.pdf, english/2020-paper2.pdf
 *   - AI:    apps/bot/src/content/exams-ai/<subject>/*.json
 *            e.g. math/algebra-set-001.json
 *
 * We resolve from process.cwd():
 *  - If service root is repo root → cwd=/…/repo
 *  - If service root is apps/bot   → cwd=/…/repo/apps/bot
 * Works in both by anchoring on BOT_ROOT.
 */
const BOT_ROOT = process.env.BOT_CWD || process.cwd();
const CONTENT_ROOT =
  path.basename(BOT_ROOT).toLowerCase() === "bot"
    ? path.resolve(BOT_ROOT, "src", "content")
    : path.resolve(BOT_ROOT, "apps", "bot", "src", "content");

const PDF_ROOT = path.join(CONTENT_ROOT, "papers");
const AI_ROOT = path.join(CONTENT_ROOT, "exams-ai");

type SourceType = PaperMeta["source"]; // "kcse" | "mock" | "ai"

/** Options for listing/filtering */
export type ListOptions = {
  year?: number;
  paper?: 1 | 2 | 3;
  source?: SourceType;
  limit?: number;
  shuffle?: boolean;
};

/** Options for choosing “next” paper */
export type NextOptions = {
  strategy?: "random" | "sequential";
  excludeIds?: string[];
  year?: number;
  paper?: 1 | 2 | 3;
  source?: SourceType;
};

/** Tiny in-process cache (signature-based) */
const cache = {
  pdf: new Map<string, PaperMeta[]>(), // key = subject
  ai: new Map<string, PaperMeta[]>(),
  sig: new Map<string, string>(), // key = dir path → signature
};

function readDirSafe(dir: string): string[] {
  try {
    return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  } catch {
    return [];
  }
}

/** Signature of a dir: filenames joined; cheap & reliable enough for dev */
function dirSignature(dir: string): string {
  const files = readDirSafe(dir);
  return files.sort().join("|");
}

function hashBase(s: string) {
  return crypto.createHash("sha1").update(s).digest("hex").slice(0, 8);
}

/** Try to get all subjects from the model; else fall back to a local constant */
function getAllSubjects(): KCSESubject[] {
  try {
    // In CJS output, `require` exists; TS will transpile fine.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const maybe = require("../models/Paper.js");
    if (Array.isArray(maybe.ALL_SUBJECTS)) return maybe.ALL_SUBJECTS as KCSESubject[];
    if (Array.isArray(maybe.SUBJECTS)) return maybe.SUBJECTS as KCSESubject[];
  } catch {
    /* ignore */
  }
  const fallback: KCSESubject[] = [
    "Mathematics",
    "English",
    "Kiswahili",
    "Biology",
    "Chemistry",
    "Physics",
    "History",
    "Geography",
    "CRE",
    "Business",
  ];
  return fallback;
}

function parsePdfName(subject: KCSESubject, file: string): PaperMeta | null {
  if (!file.toLowerCase().endsWith(".pdf")) return null;
  // Accept "paper1", "paper-1", "paper_1", "paper 1"; optional YYYY prefix somewhere
  const m = file.match(/(?:(\d{4}).*?)?paper[\s\-_]?([123])/i);
  const year = m?.[1] ? Number(m[1]) : undefined;
  const paperNum = (m?.[2] ? Number(m[2]) : 1) as 1 | 2 | 3;
  // Use subject+file in hash to avoid collisions across folders
  const id = `${subject.toLowerCase()}-${year ?? "na"}-p${paperNum}-${hashBase(
    subject.toLowerCase() + ":" + file
  )}`;

  return {
    id,
    subject,
    paper: paperNum,
    year,
    source: "kcse",
    filePath: path.join(PDF_ROOT, subject.toLowerCase(), file),
  };
}

function parseAiJson(subject: KCSESubject, file: string): PaperMeta | null {
  if (!file.toLowerCase().endsWith(".json")) return null;
  const id = `${subject.toLowerCase()}-ai-${hashBase(subject.toLowerCase() + ":" + file)}`;
  return {
    id,
    subject,
    paper: 1, // default; AI can define its own internal structure
    source: "ai",
    // For AI sets we store a local path in textUrl; caller reads & parses it
    textUrl: path.join(AI_ROOT, subject.toLowerCase(), file),
  } as unknown as PaperMeta;
}

/** Load & cache PDFs for a subject; invalidates when directory signature changes */
function loadPdfs(subject: KCSESubject): PaperMeta[] {
  const dir = path.join(PDF_ROOT, String(subject).toLowerCase());
  const sig = dirSignature(dir);
  const key = `pdf:${dir}`;
  const last = cache.sig.get(key);

  if (cache.pdf.has(subject) && last === sig) return cache.pdf.get(subject)!;

  const files = readDirSafe(dir);
  const items = files.map((f) => parsePdfName(subject, f)).filter(Boolean) as PaperMeta[];

  cache.pdf.set(subject, items);
  cache.sig.set(key, sig);
  return items;
}

/** Load & cache AI JSON sets for a subject */
function loadAiSets(subject: KCSESubject): PaperMeta[] {
  const dir = path.join(AI_ROOT, String(subject).toLowerCase());
  const sig = dirSignature(dir);
  const key = `ai:${dir}`;
  const last = cache.sig.get(key);

  if (cache.ai.has(subject) && last === sig) return cache.ai.get(subject)!;

  const files = readDirSafe(dir);
  const items = files.map((f) => parseAiJson(subject, f)).filter(Boolean) as PaperMeta[];

  cache.ai.set(subject, items);
  cache.sig.set(key, sig);
  return items;
}

/** Merge sources with optional filtering and sorting. */
export async function listPapers(subject: KCSESubject, opts: ListOptions = {}): Promise<PaperMeta[]> {
  const pdfs = loadPdfs(subject);
  const ais = loadAiSets(subject);
  let all = [...pdfs, ...ais];

  if (opts.source) all = all.filter((p) => p.source === opts.source);
  if (opts.year) all = all.filter((p) => p.year === opts.year);
  if (opts.paper) all = all.filter((p) => p.paper === opts.paper);

  // Sort by: (year desc, paper asc, source pref: kcse > mock > ai)
  all.sort((a, b) => {
    const ya = a.year ?? -Infinity;
    const yb = b.year ?? -Infinity;
    if (yb !== ya) return yb - ya;
    if (a.paper !== b.paper) return a.paper - b.paper;
    const srcRank = (s: SourceType) => (s === "kcse" ? 0 : s === "mock" ? 1 : 2);
    return srcRank(a.source) - srcRank(b.source);
  });

  if (opts.shuffle) {
    // Fisher–Yates
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
  }

  if (opts.limit && opts.limit > 0) all = all.slice(0, opts.limit);
  return all;
}

/** Look up by id across both sources. */
export async function getPaperById(id: string): Promise<PaperMeta | null> {
  const subjects: KCSESubject[] = getAllSubjects();
  for (const s of subjects) {
    const pdfs = loadPdfs(s);
    const ais = loadAiSets(s);
    const hit = [...pdfs, ...ais].find((p) => p.id === id);
    if (hit) return hit;
  }
  return null;
}

/**
 * Smart "next" chooser for a subject.
 * - strategy: "random" (default) or "sequential"
 * - excludeIds: avoid serving the same paper(s) again this session
 * - optional filters: year/paper/source
 */
export async function getNextPaper(
  subject: KCSESubject,
  opts: NextOptions = {}
): Promise<PaperMeta | null> {
  const { strategy = "random", excludeIds = [], year, paper, source } = opts;

  let pool = await listPapers(subject, { year, paper, source });

  if (excludeIds.length) {
    const exclude = new Set(excludeIds);
    pool = pool.filter((p) => !exclude.has(p.id));
  }

  if (pool.length === 0) return null;

  if (strategy === "sequential") {
    // already sorted by year desc, paper asc, kcse>mock>ai
    return pool[0];
  }

  // random
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

/**
 * Minimal resolver used by session-start.ts
 * - If URL provided → { type:"url" }
 * - Else prefer filePath
 * - Else synthesize path from subject/year/paper under PDF_ROOT
 */
export function resolvePaperUrl(p: PaperMeta): { type: "url" | "file"; value: string } {
  const anyP = p as any;
  if (anyP.url && /^https?:\/\//i.test(anyP.url)) {
    return { type: "url", value: anyP.url };
  }
  if (p.filePath) {
    return { type: "file", value: p.filePath };
  }
  const subj = String(p.subject).toLowerCase();
  const yr = String(p.year ?? "unknown");
  const num = p.paper ?? (anyP.paperNumber ?? 1);
  const synthesized = path.join(PDF_ROOT, subj, `${yr}-paper${num}.pdf`);
  return { type: "file", value: synthesized };
}

/**
 * Higher-level resolver if you want to actually load AI JSON sets.
 * Prefers AI branch when source === "ai".
 * - For PDFs: returns { kind:"pdf", filePath }
 * - For AI JSON: returns { kind:"ai", json }
 */
export function resolvePaperContent(
  p: PaperMeta
): { kind: "pdf"; filePath: string } | { kind: "ai"; json: any } {
  if (p.source === "ai" && (p as any).textUrl) {
    const full = (p as any).textUrl as string;
    if (!fs.existsSync(full)) throw new Error(`AI JSON not found: ${full}`);
    const raw = fs.readFileSync(full, "utf8");
    return { kind: "ai", json: JSON.parse(raw) };
  }
  if (p.filePath) {
    if (!fs.existsSync(p.filePath)) throw new Error(`PDF not found: ${p.filePath}`);
    return { kind: "pdf", filePath: p.filePath };
  }
  if ((p as any).textUrl) {
    const full = (p as any).textUrl as string;
    if (!fs.existsSync(full)) throw new Error(`AI JSON not found: ${full}`);
    const raw = fs.readFileSync(full, "utf8");
    return { kind: "ai", json: JSON.parse(raw) };
  }
  throw new Error(`PaperMeta has no filePath/textUrl: ${p.id}`);
}
