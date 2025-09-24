// apps/bot/src/services/drill-service.ts
export type DrillInput = { topic: string; level?: "normal" | "hard" };
export type Drill = {
  topic: string;
  questions: Array<{ prompt: string; hint?: string }>;
  tips?: string[];
};

/**
 * Minimal stub – replace with generator, DB, or LLM-backed pool later.
 * Keep it deterministic so tests won’t flake.
 */
export async function buildDrill(input: DrillInput): Promise<Drill> {
  const topic = input.topic.trim();
  const hard = input.level === "hard";

  const baseQs = [
    { prompt: `Define ${topic} and give one example.`, hint: `Keep it concise; 1–2 lines.` },
    { prompt: `Solve a basic problem involving ${topic}. Show key steps.` },
    { prompt: `Name a common mistake when attempting ${topic} and how to avoid it.` },
  ];

  const hardQs = [
    { prompt: `Create a tricky original question on ${topic} and then solve it.`, hint: `Push edge cases.` },
    { prompt: `Contrast ${topic} with a closely related concept; highlight differences with examples.` },
  ];

  return {
    topic,
    questions: hard ? baseQs.concat(hardQs) : baseQs,
    tips: [
      `Scan for units/keywords related to ${topic} before writing.`,
      `Work backwards from what is asked; don’t dump everything you remember.`,
      `After answering, sanity-check: does your result make sense?`,
    ],
  };
}
