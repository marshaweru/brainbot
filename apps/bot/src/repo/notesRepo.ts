// apps/bot/src/repo/notesRepo.ts
import { promises as fs } from "fs";
import path from "path";
import { SUBJECTS } from "../subjects.js";

const NOTES_ROOT = path.resolve(__dirname, "..", "content", "notes");

/** Normalize "Math / mathematics" → "mathematics" for folder names */
function normalizeSubjectLabel(label?: string | null): string | null {
  if (!label) return null;

  const lower = String(label).toLowerCase();

  // SUBJECTS can be strings or { slug, label }
  const hit =
    (SUBJECTS as any[]).find((s) => s?.slug?.toLowerCase?.() === lower) ??
    (SUBJECTS as any[]).find((s) => s?.label?.toLowerCase?.() === lower) ??
    (SUBJECTS as any[]).find((s) => String(s).toLowerCase() === lower);

  if (!hit) return lower;
  return (hit as any).slug || (hit as any).label || String(hit);
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
}

export type NoteDoc = {
  subject: string | null; // folder slug (e.g., "mathematics") or null if global
  topic: string;          // human-friendly topic derived from filename
  filename: string;       // absolute path to the file on disk
  relpath: string;        // relative to NOTES_ROOT
  markdown: string;       // file contents
};

async function readNoteFile(abs: string, subjectSlug: string | null): Promise<NoteDoc> {
  const md = await fs.readFile(abs, "utf8");
  const rel = path.relative(NOTES_ROOT, abs);
  const base = path.basename(abs).replace(/\.md$/i, "");
  const topic = base.replace(/^\d+[-_ ]*/, "").replace(/[_-]+/g, " ").trim();
  return { subject: subjectSlug, topic, filename: abs, relpath: rel, markdown: md };
}

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

export async function getNotes(topic: string, subjectLabel?: string | null): Promise<NoteDoc[]> {
  const q = topic?.trim();
  if (!q) return [];

  const subjectSlug = normalizeSubjectLabel(subjectLabel);
  const topicSlug = slug(q);
  const results: NoteDoc[] = [];

  const scanFolder = async (folder: string, subjSlug: string | null) => {
    const entries = await safeReaddir(folder);
    if (!entries.length) return;

    const mdFiles = entries.filter((f) => f.toLowerCase().endsWith(".md"));

    // First pass: filename slug match (fast)
    for (const file of mdFiles) {
      if (file.toLowerCase().includes(topicSlug)) {
        results.push(await readNoteFile(path.join(folder, file), subjSlug));
      }
    }

    // Second pass: content contains raw query (only if none found yet)
    if (results.length === 0) {
      const qLower = q.toLowerCase();
      for (const file of mdFiles) {
        const abs = path.join(folder, file);
        const text = await fs.readFile(abs, "utf8").catch(() => "");
        if (text && text.toLowerCase().includes(qLower)) {
          results.push(await readNoteFile(abs, subjSlug));
        }
      }
    }
  };

  // Prefer subject-specific folder when provided
  if (subjectSlug) {
    await scanFolder(path.join(NOTES_ROOT, subjectSlug), subjectSlug);
  }

  // If nothing yet, scan all subject folders (shallow)
  if (results.length === 0) {
    const subjects = await safeReaddir(NOTES_ROOT);
    for (const subj of subjects) {
      const full = path.join(NOTES_ROOT, subj);
      const stat = await fs.stat(full).catch(() => null);
      if (stat?.isDirectory()) {
        await scanFolder(full, subj);
        if (results.length) break;
      }
    }
  }

  return results;
}
