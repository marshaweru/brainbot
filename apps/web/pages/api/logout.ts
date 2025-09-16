// apps/web/pages/api/logout.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { clearAuthCookie } from "@/lib/auth";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  clearAuthCookie(res);
  res.json({ ok: true });
}
