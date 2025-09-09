export async function handleMarking({
  subject,
  answer
}: {
  subject: string;
  answer: string;
}) {
  // TODO: Integrate with GPT-4 Turbo API and shared prompt
  return {
    score: 23,
    outOf: 25,
    rubric: [
      { step: "Expansion", mark: "+1", correct: true },
      { step: "Factorization", mark: "+2", correct: true },
      { step: "Final step", mark: "-1", correct: false }
    ],
    tip: "Review Probability, focus on Q7 style!"
  };
}
