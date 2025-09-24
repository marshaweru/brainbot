// apps/web/app/api/mark/route.ts
import { NextRequest, NextResponse } from "next/server";

type MarkReq = { subject?: string; answer?: string };

const SUBJECTS = new Set([
  "Mathematics", "English", "Kiswahili",
  "Biology", "Chemistry", "Physics",
  "History & Government", "Geography", "CRE",
  "Business Studies",
]);

export async function POST(req: NextRequest) {
  try {
    // Basic content-type guard
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return NextResponse.json({ ok: false, msg: "expected application/json" }, { status: 415 });
    }

    const body: MarkReq = await req.json();
    const subject = (body.subject || "").trim();
    const answer  = (body.answer  || "").trim();

    if (!subject || !answer) {
      return NextResponse.json({ ok: false, msg: "missing subject or answer" }, { status: 400 });
    }
    if (!SUBJECTS.has(subject)) {
      return NextResponse.json({ ok: false, msg: "unsupported subject" }, { status: 400 });
    }
    if (answer.length > 10_000) {
      return NextResponse.json({ ok: false, msg: "answer too long" }, { status: 413 });
    }

    // TODO: plug in real OpenAI/marking logic here.
    // Placeholder response (deterministic-ish so UI is testable)
    const sample = {
      ok: true,
      score: 23,
      outOf: 25,
      strong: ["Algebra", "Geometry"],
      weak: ["Probability"],
      rubric: [
        { step: "Expansion", mark: "+1", correct: true },
        { step: "Factorization", mark: "+2", correct: true },
        { step: "Final step", mark: "-1", correct: false },
      ],
      tip: "Review Probability, focus on Q7 style!",
    };

    return NextResponse.json(sample, { status: 200 });
  } catch (err) {
    console.error("POST /api/mark failed:", err);
    return NextResponse.json({ ok: false, msg: "server error" }, { status: 500 });
  }
}
