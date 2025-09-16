// apps/web/app/api/start-token/route.ts
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { signHS256 } from "@/lib/jwt";

const SECRET = process.env.START_TOKEN_SECRET!;

export async function POST(req: Request) {
  const { plan, wid: clientWid } = await req.json().catch(() => ({}));
  const wid = clientWid || randomUUID();
  const jti = randomUUID();
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 10 * 60; // 10 minutes
  const expiresAt = new Date(exp * 1000); // TTL anchor

  const token = signHS256(
    { sub: wid, plan: (plan || "free").toLowerCase(), jti, iat, exp },
    SECRET
  );

  const database = await db();
  await database.collection("link_tokens").insertOne({
    jti,
    wid,
    plan: (plan || "free").toLowerCase(),
    exp,
    issuedAt: new Date().toISOString(),
    used: false,
    expiresAt, // ← enables MongoDB TTL expiry
  });

  return NextResponse.json({ wid, token, startParam: `st_${token}`, exp });
}
