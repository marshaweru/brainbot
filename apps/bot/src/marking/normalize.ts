// If you already normalize inside feedback/adapter.ts, you can skip this file.
// Kept for future tweaks.
export function extractGrade(feedback: any): { numeric?: number; text?: string; weakTopics: string[] } {
  const numeric = Number(feedback?.grade ?? feedback?.score ?? feedback?.overall ?? NaN);
  const text = typeof feedback?.gradeText === "string" ? feedback.gradeText : undefined;
  const weakTopics: string[] =
    Array.isArray(feedback?.weakTopics) ? feedback.weakTopics : [];

  return {
    numeric: Number.isFinite(numeric) ? numeric : undefined,
    text,
    weakTopics,
  };
}
