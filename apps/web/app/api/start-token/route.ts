// apps/web/app/api/start-token/route.ts
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { signHS256 } from "@/lib/jwt";

export const runtime = "nodejs";

const SECRET = process.env.START_TOKEN_SECRET!;

type StartReq = { plan?: string; wid?: string };
type StartResp = { ok: true; wid: string; token: string; startParam: string; exp: number } | { ok: false; msg: string };

const PLAN_WHITELIST = new Set(["free", "lite", "steady", "serious", "elite", "limited"]);

export async function POST(req: Request): Promise<NextResponse<StartResp>> {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return NextResponse.json({ ok: false, msg: "expected application/json" }, { status: 415 });
    }

    const { plan, wid: clientWid } = (await req.json().catch(() => ({}))) as StartReq;

    const wid = (clientWid && String(clientWid).trim()) || randomUUID();
    const planNorm = String(plan || "free").toLowerCase();
    const planSafe = PLAN_WHITELIST.has(planNorm) ? planNorm : "free";

    const jti = randomUUID();
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 10 * 60; // 10 minutes (JWT & link TTL)
    const expiresAt = new Date(exp * 1000);

    const token = signHS256({ sub: wid, plan: planSafe, jti, iat, exp }, SECRET);

    const database = await db();
    await database.collection("link_tokens").insertOne({
      jti,
      wid,
      plan: planSafe,
      exp,
      issuedAt: new Date().toISOString(),
      used: false,
      expiresAt, // TTL anchor (ensure an index: { expiresAt: 1 }, { expireAfterSeconds: 0 })
    });

    return NextResponse.json({ ok: true, wid, token, startParam: `st_${token}`, exp });
  } catch (err) {
    console.error("POST /api/start-token failed:", err);
    return NextResponse.json({ ok: false, msg: "server error" }, { status: 500 });
  }
}
