// apps/bot/src/marking.ts
// Simple demo marker used by markingRepo → toFeedback → latest_feedback.
// Scores by “how much content the student submitted” and returns a couple of weak topics.

export type RawMarking = {
  score: number;
  outOf: number;
  remarks: string;
  weakTopics: Array<{ topic: string; tip?: string }>;
};

type Upload = {
  kind: "photo" | "voice" | "document" | "text";
  text?: string;
  localPath?: string;
  mimeType?: string;
};

/**
 * uploads: the array you store during the session (photo/voice/document/text)
 * subjectLabel: e.g., "Chemistry"
 */
export async function handleMarking(
  uploads: Upload[],
  subjectLabel: string
): Promise<RawMarking> {
  // Naive heuristic: more stuff submitted ⇒ higher score (for demo)
  let words = 0;

  for (const u of uploads) {
    if (u.text) {
      words += u.text.split(/\s+/).filter(Boolean).length;
    } else if (u.localPath) {
      // Pretend OCR/ASR gave us signal for non-text uploads
      words += 150;
    }
  }

  const outOf = 100;
  const score = Math.max(20, Math.min(outOf, Math.round(words / 6)));

  const topicBank: Record<string, string[]> = {
    Mathematics: ["Algebra", "Statistics", "Trigonometry"],
    Chemistry: ["Stoichiometry", "Organic Reactions", "Acids & Bases"],
    Biology: ["Cell Biology", "Ecology", "Genetics"],
    Physics: ["Mechanics", "Electricity", "Waves"],
    English: ["Comprehension", "Grammar", "Summary"],
    Kiswahili: ["Insha", "Matumizi ya Lugha", "Ufahamu"],
    Geography: ["Mapwork", "Climatology", "Geomorphology"],
    "History & Government": ["Kenyan History", "World Wars", "Civics"],
    CRE: ["Christian Living", "Bible Themes", "Ethics"],
    "Business Studies": ["Accounting", "Demand & Supply", "Entrepreneurship"],
  };

  const pool = topicBank[subjectLabel] ?? ["Topic A", "Topic B", "Topic C"];
  const weakTopics = pool.slice(0, 2).map((t) => ({
    topic: t,
    tip: `Revise ${t} basics and work 3 extra questions.`,
  }));

  const remarks =
    "Demo marking complete. This score is content-weighted for testing. The production marker will use KCSE-style rubrics with citations.";

  return { score, outOf, remarks, weakTopics };
}
