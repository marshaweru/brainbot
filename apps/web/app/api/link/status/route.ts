import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });

  const database = await db();
  const doc = await database.collection("link_codes").findOne({ code });

  if (!doc) return NextResponse.json({ found: false });
  const now = Date.now();
  const expired = doc.expiresAt && now > Date.parse(doc.expiresAt);

  return NextResponse.json({
    found: true,
    expired,
    claimed: !!doc.claimedBy,
    claimedBy: doc.claimedBy ?? null,
  });
}
