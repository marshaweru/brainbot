// apps/bot/src/services/insights.ts

export type Insight = {
  tips: string[];
};

const FALLBACK_TIPS = [
  "Show all your working clearly.",
  "Underline or highlight key words in the question.",
  "Check units and conversions carefully.",
];

export async function getOrGenerateInsight(subject: string, topic: string): Promise<Insight> {
  // TODO: later, hook this up to insightsRepo + AI/KNEC data
  return {
    tips: [
      `In ${subject}, candidates often drop marks in ${topic} due to skipped steps.`,
      `Revise KNEC marking keywords for ${topic}.`,
      ...FALLBACK_TIPS,
    ],
  };
}
