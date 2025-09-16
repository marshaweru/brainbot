// apps/web/pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { issueJwt, setAuthCookie } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "email & password required" });
    }

    // TODO: replace with real user check
    const conn = await db();
    const users = conn.collection("users");
    const user = await users.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(401).json({ ok: false, error: "invalid credentials" });
    // naive: accept any password in dev; in prod check a hashed pw
    // if (!(await verifyPassword(password, user.passwordHash))) return res.status(401).json({ ok:false, error:"invalid credentials" });

    const token = await issueJwt(String(user._id), {
      email: user.email,
      roles: user.roles ?? [],
      name: user.name ?? "",
    });

    setAuthCookie(res, token);
    return res.json({ ok: true, user: { id: String(user._id), email: user.email } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
}
