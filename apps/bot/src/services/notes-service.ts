// apps/bot/src/services/notes-service.ts
import { readFile } from "node:fs/promises";
import Handlebars from "handlebars";
import { z } from "zod";

import { getNotes } from "../repo/notesRepo.js";
import { PROMPTS } from "../prompts/index.js";

type Result = { topic: string; found: boolean; preview?: string; summary?: any };

const MEM_CACHE = new Map<string, Result>();
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** -----------------------------
 * Zod schema for summarizer JSON
 * ----------------------------- */
const NotesSummary = z.object({
  subject: z.string(),
  topic: z.string(),
  level: z.string(),
  summaryPoints: z.array(z.string()),
  definitions: z.array(
    z.object({ term: z.string(), definition: z.string() })
  ),
  formulas: z.array(
    z.object({ formula: z.string(), explanation: z.string() })
  ),
  examples: z.array(
    z.object({ example: z.string(), note: z.string() })
  ),
  misconceptions: z.array(
    z.object({ description: z.string(), correction: z.string() })
  ),
  examItems: z.array(
    z.object({ q: z.string(), hint: z.string() })
  ),
  examinerTone: z.string(),
});
type NotesSummaryOut = z.infer<typeof NotesSummary>;

/** -----------------------------
 * Compile notes with summarization
 * ----------------------------- */
export async function compileNotesForWeakTopics(
  topics: string[],
  subjectLabel?: string | null,
  opts: { llm?: (prompt: string) => Promise<string>; level?: string } = {}
): Promise<Result[]> {
  const results: Result[] = [];

  for (const raw of topics) {
    const key = `${subjectLabel ?? "?"}#${norm(raw)}`;
    const cached = MEM_CACHE.get(key);
    if (cached) {
      results.push(cached);
      continue;
    }

    try {
      const hits = await getNotes(raw, subjectLabel ?? undefined);

      const h0 = hits?.[0] as any | undefined;
      const rawPreview: unknown =
        h0?.snippet ?? h0?.text ?? h0?.markdown ?? h0?.content ?? "";
      const preview =
        typeof rawPreview === "string" ? rawPreview.slice(0, 120) : undefined;

      let summary: NotesSummaryOut | undefined;

      if (opts.llm && typeof rawPreview === "string" && rawPreview.trim()) {
        try {
          const tpl = await readFile(PROMPTS.notesSummarizer, "utf8");
          const prompt = Handlebars.compile(tpl)({
            subject: subjectLabel ?? "Unknown",
            topic: raw,
            level: opts.level ?? "KCSE",
            rawNotes: rawPreview,
          });
          const rawResp = await opts.llm(prompt);
          summary = NotesSummary.parse(JSON.parse(rawResp));
        } catch {
          summary = undefined; // fail safe: no summary, just preview
        }
      }

      const res: Result = {
        topic: raw,
        found: !!(hits && hits.length),
        preview,
        summary,
      };
      MEM_CACHE.set(key, res);
      results.push(res);
    } catch {
      const res: Result = { topic: raw, found: false };
      MEM_CACHE.set(key, res);
      results.push(res);
    }
  }
  return results;
}

export function clearNotesCache() {
  MEM_CACHE.clear();
}
