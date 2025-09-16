// apps/bot/src/services/paper-assigner.ts
import { KCSESubject, PaperMeta } from "../models/Paper";
import { getNextPaper } from "../repo/papersRepo";

/**
 * Assign the next paper for a given subject.
 *
 * Defaults to random, but you can plug in different strategies
 * (rotation, excludeIds per student, etc.).
 */
export async function assignPaper(
  subject: string,
  opts: {
    strategy?: "random" | "sequential";
    excludeIds?: string[];
    year?: number;
    paper?: 1 | 2 | 3;
    source?: PaperMeta["source"];
  } = {}
): Promise<PaperMeta | null> {
  const normalized = subject as KCSESubject;
  return getNextPaper(normalized, opts);
}
