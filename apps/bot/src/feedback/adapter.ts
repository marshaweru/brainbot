// apps/bot/src/feedback/adapter.ts
// Adapter: turn RawMarking (from marking.ts) into a normalized shape the repo uses.

export type RawMarking = {
  score: number;
  outOf: number;
  remarks: string;
  weakTopics: Array<{ topic: string; tip?: string }>;
};

export async function toFeedback(raw: RawMarking) {
  return {
    score: raw.score,
    outOf: raw.outOf,
    grade: gradeFromPct(raw.score, raw.outOf),
    weakTopics: raw.weakTopics,
    remarks: raw.remarks,
  };
}

function gradeFromPct(score: number, outOf: number) {
  const pct = outOf > 0 ? (score / outOf) * 100 : 0;
  if (pct >= 80) return "A";
  if (pct >= 75) return "A-";
  if (pct >= 70) return "B+";
  if (pct >= 65) return "B";
  if (pct >= 60) return "B-";
  if (pct >= 55) return "C+";
  if (pct >= 50) return "C";
  if (pct >= 45) return "C-";
  if (pct >= 40) return "D+";
  if (pct >= 35) return "D";
  if (pct >= 30) return "D-";
  return "E";
}
