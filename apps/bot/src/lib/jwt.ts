// apps/bot/src/lib/jwt.ts
import jwt from "jsonwebtoken";
import { z } from "zod";

// Shape of payloads we issue
export const JwtPayloadSchema = z.object({
  sub: z.string(),         // subject (Telegram ID or userId)
  role: z.string().optional(), // optional role: "user" | "admin"
  exp: z.number(),         // expiration (unix seconds)
});

export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

/** Issue a signed JWT for a given Telegram ID */
export function signJwt(telegramId: string, role: string = "user", ttlSeconds = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload: JwtPayload = { sub: telegramId, role, exp };
  return jwt.sign(payload, SECRET, { algorithm: "HS256" });
}

/** Verify and parse a JWT; throws if invalid or expired */
export function verifyJwt(token: string): JwtPayload {
  const decoded = jwt.verify(token, SECRET, { algorithms: ["HS256"] });
  const parsed = JwtPayloadSchema.safeParse(decoded);
  if (!parsed.success) throw new Error("Invalid JWT payload");
  return parsed.data;
}

/** Try-verify, return null instead of throwing */
export function tryVerifyJwt(token: string): JwtPayload | null {
  try {
    return verifyJwt(token);
  } catch {
    return null;
  }
}
