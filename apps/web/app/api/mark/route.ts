import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // TODO: Plug into OpenAI/marking logic
  const { subject, answer } = await req.json();
  return NextResponse.json({
    ok: true,
    score: 23,
    outOf: 25,
    strong: ["Algebra", "Geometry"],
    weak: ["Probability"],
    rubric: [
      { step: "Expansion", mark: "+1", correct: true },
      { step: "Factorization", mark: "+2", correct: true },
      { step: "Final step", mark: "-1", correct: false }
    ],
    tip: "Review Probability, focus on Q7 style!"
  });
}
