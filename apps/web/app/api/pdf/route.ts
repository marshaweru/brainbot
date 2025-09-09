import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // TODO: Generate real PDF of feedback/answers
  return NextResponse.json({ ok: true, url: "/stub-pdf.pdf" });
}
