// apps/bot/src/services/drill-engine.ts

export type DrillQuestion = {
  q: string;
  answer?: string;
  markingGuide?: string;
  difficulty?: number; // 1–3
};

export async function getDrill(
  subject: string,
  topic: string,
  count = 6,
  difficulty = 1
) {
  // Placeholder generator for now; replace with GPT or DB later
  const qs: DrillQuestion[] = Array.from({ length: count }).map((_, i) => ({
    q: `${i + 1}. (${subject}) ${topic}: write a short solution showing key steps.`,
    answer: "Sample outline answer (replace with real)",
    markingGuide: "Award method marks. Penalize unit/format errors.",
    difficulty,
  }));

  return { subject, topic, difficulty, questions: qs };
}
