// apps/bot/src/services/notes-service.ts
import { getNotes } from "../repo/notesRepo.js";

/**
 * Prepares notes for a set of weak topics so follow-up commands feel instant.
 * Returns a small summary array; safe to call-and-forget in /finish.
 */
export async function compileNotesForWeakTopics(
  topics: string[],
  subjectLabel?: string | null
): Promise<Array<{ topic: string; found: boolean }>> {
  const results: Array<{ topic: string; found: boolean }> = [];
  for (const topic of topics) {
    try {
      const hits = await getNotes(topic, subjectLabel ?? undefined);
      results.push({ topic, found: hits.length > 0 });
    } catch {
      results.push({ topic, found: false });
    }
  }
  return results;
}
// notes-service placeholder
