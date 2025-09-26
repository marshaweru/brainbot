// apps/bot/src/repo/notesRepo.ts
// Null-safe notes repo with flexible fields (snippet | text | markdown).
// If you already have a custom implementation, keep the types and the
// subject handling pattern (no `null` assignments).

import fs from "fs";
import path from "path";

export type NoteDoc = {
  topic: string;                // canonical topic (e.g., "Quadratic equations")
  subject?: string;             // optional subject label (no nulls)
  relpath?: string;             // where it came from (for hints)
  markdown?: string;            // full content if loaded
  text?: string;                // plain text (optional)
  snippet?: string;             // teaser/preview (optional)
  createdAt?: Date;
  updatedAt?: Date;
};

// ---- tiny utils ------------------------------------------------------------

const NOTES_DIRS = [
  // Add any directories where your notes live (relative to repo root)
  "apps/bot/src/content/notes",
  "apps/bot/content/notes",
  "content/notes",
];

function existingDir(p: string) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch { return false; }
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function safeSnippet(s: string, max = 160) {
  const cleaned = s.replace(/[_*`>#-]/g, "").replace(/\s+/g, " ").trim();
  return cleaned.length > max ? cleaned.slice(0, max - 1) + "…" : cleaned;
}

// ---- FS-backed fallback (subject → *.md under a folder) --------------------
// Directory structure supported (examples):
//   content/notes/Mathematics/Quadratic equations.md
//   content/notes/Biology/Respiration.md
//
// If you already have a DB-backed index, swap this out and keep the types.

function listCandidateFiles(): string[] {
  const cwd = process.cwd();
  const roots = NOTES_DIRS
    .map((d) => path.resolve(cwd, d))
    .filter(existingDir);

  const files: string[] = [];
  for (const root of roots) {
    const walk = (dir: string) => {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        const st = fs.statSync(p);
        if (st.isDirectory()) walk(p);
        else if (st.isFile() && /\.md$/i.test(name)) files.push(p);
      }
    };
    walk(root);
  }
  return files;
}

let FILE_CACHE: Array<{ abs: string; rel: string; subject?: string; topic: string }> | null = null;

function buildFileIndex() {
  if (FILE_CACHE) return FILE_CACHE;
  const cwd = process.cwd();
  const files = listCandidateFiles();
  FILE_CACHE = files.map((abs) => {
    const rel = path.relative(cwd, abs);
    const parts = rel.split(path.sep);
    // crude heuristic: .../notes/<subject>/<topic>.md
    const topic = path.basename(abs, path.extname(abs));
    const notesIdx = parts.findIndex((p) => p.toLowerCase() === "notes");
    const subject = notesIdx >= 0 && parts[notesIdx + 1] ? parts[notesIdx + 1] : undefined;
    return { abs, rel, subject, topic };
  });
  return FILE_CACHE;
}

// ---- Public API ------------------------------------------------------------

/**
 * getNotes(topic, subject?)
 * - Returns best-effort matches for a topic, optionally scoped to subject.
 * - Never writes `null` into fields typed as `string | undefined`.
 */
export async function getNotes(topic: string, subjectLabel?: string): Promise<NoteDoc[]> {
  const tNorm = normalize(topic);
  const sNorm = subjectLabel ? normalize(subjectLabel) : undefined;

  const idx = buildFileIndex();

  // Filter candidates by subject (if provided)
  const scoped = idx.filter((f) =>
    sNorm ? normalize(f.subject ?? "") === sNorm : true
  );

  // Simple match: filename contains topic words
  const words = tNorm.split(" ").filter(Boolean);
  const candidates = scoped.filter((f) => {
    const name = normalize(f.topic);
    return words.every((w) => name.includes(w));
  });

  // Load a few matches (cap to 5)
  const top = candidates.slice(0, 5);

  const out: NoteDoc[] = [];
  for (const f of top) {
    try {
      const markdown = fs.readFileSync(f.abs, "utf8");
      out.push({
        topic: f.topic,
        ...(f.subject ? { subject: f.subject } : {}), // ✅ no nulls — only set when truthy
        relpath: f.rel,
        markdown,
        snippet: safeSnippet(markdown),
        createdAt: new Date(fs.statSync(f.abs).birthtimeMs || fs.statSync(f.abs).mtimeMs),
        updatedAt: new Date(fs.statSync(f.abs).mtimeMs),
      });
    } catch {
      // If file read fails, still return a pointer doc without content
      out.push({
        topic: f.topic,
        ...(f.subject ? { subject: f.subject } : {}), // ✅ no nulls
        relpath: f.rel,
      });
    }
  }

  return out;
}
