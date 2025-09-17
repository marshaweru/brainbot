import { promises as fs } from "fs";
import path from "path";
import { SUBJECTS } from "../subjects";
import { fileURLToPath } from "url";

// ESM-safe dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NOTES_ROOT = path.resolve(__dirname, "..", "content", "notes");

/** Normalize "Math / mathematics" → "mathematics" for folder names */
function normalizeSubjectLabel(label?: string | null): string | null {
  if (!label) return null;

  const lower = label.toLowerCase();
  const hit =
    SUBJECTS.find((s: any) => s?.slug?.toLowerCase?.() === lower) ||
    SUBJECTS.find((s: any) => s?.label?.toLowerCase?.() === lower) ||
    SUBJECTS.find((s: any) => String(s).toLowerCase() === lower);

  if (!hit) return lower;
  return (hit as any).slug || (hit as any).label || String(hit);
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
}

export type NoteDoc = {
  subject: string | null;
  topic: string;
  filename: string;
  relpath: string;
  markdown: string;
};

async function readNoteFile(abs: string, subjectSlug: string | null): Promise<NoteDoc> {
  const md = await fs.readFile(abs, "utf8");
  const rel = path.relative(NOTES_ROOT, abs);
  const base = path.basename(abs).replace(/\.md$/i, "");
  const topic = base.replace(/^\d+[-_ ]*/, "").replace(/[_-]+/g, " ").trim();
  return { subject: subjectSlug, topic, filename: abs, relpath: rel, markdown: md };
}

export async function getNotes(topic: string, subjectLabel?: string | null): Promise<NoteDoc[]> {
  const subjectSlug = normalizeSubjectLabel(subjectLabel);
  const topicSlug = slug(topic);
  const results: NoteDoc[] = [];

  const scanFolder = async (folder: string, subjSlug: string | null) => {
    let entries: string[] = [];
    try {
      entries = await fs.readdir(folder);
    } catch {
      return;
    }
    const mdFiles = entries.filter((f) => f.toLowerCase().endsWith(".md"));

    for (const file of mdFiles) {
      if (file.toLowerCase().includes(topicSlug)) {
        results.push(await readNoteFile(path.join(folder, file), subjSlug));
      }
    }

    if (results.length === 0) {
      for (const file of mdFiles) {
        const abs = path.join(folder, file);
        const text = await fs.readFile(abs, "utf8");
        if (text.toLowerCase().includes(topic.toLowerCase())) {
          results.push(await readNoteFile(abs, subjSlug));
        }
      }
    }
  };

  if (subjectSlug) await scanFolder(path.join(NOTES_ROOT, subjectSlug), subjectSlug);

  if (results.length === 0) {
    let subjects: string[] = [];
    try {
      subjects = await fs.readdir(NOTES_ROOT);
    } catch {
      return [];
    }
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
