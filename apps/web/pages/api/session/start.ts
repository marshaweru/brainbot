import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "node:crypto";

type StartResp = {
  wid: string;
  token?: string;
  startParam?: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StartResp>
) {
  try {
    if (req.method !== "POST") {
      return res
        .status(405)
        .json({ wid: "", error: "Method not allowed" });
    }

    // Parse body
    const { plan, wid } =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    // Ensure a wid exists
    const widFinal: string =
      (typeof wid === "string" && wid.trim()) ||
      crypto.randomUUID().replace(/-/g, "").slice(0, 12);

    // Simple payload encoding
    const payload = { plan: String(plan || "free"), wid: widFinal };
    const startParam =
      "st_" +
      Buffer.from(JSON.stringify(payload)).toString("base64url");

    return res.status(200).json({
      wid: widFinal,
      startParam,
    });
  } catch (e: any) {
    return res
      .status(500)
      .json({ wid: "", error: e?.message || "Internal error" });
  }
}
