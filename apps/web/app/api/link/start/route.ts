import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function makeCode() {
  // 6-digit, avoid leading zeros confusion by padding.
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST() {
  const database = await db();
  const codes = database.collection("link_codes");

  const code = makeCode();
  const now = new Date();
  const expires = new Date(now.getTime() + 10 * 60 * 1000); // 10 min

  await codes.insertOne({
    code,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  });

  return NextResponse.json({ code, expiresAt: expires.toISOString() });
}
