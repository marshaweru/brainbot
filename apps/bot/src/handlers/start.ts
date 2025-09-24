// apps/bot/src/handlers/start.ts
import { Telegraf, Context } from "telegraf";
import { confirmLinkOnWeb } from "../services/confirmLink.js";
import { startDrill } from "./drills.js";
import { getDb, userLinks, ensureUserLinksIndexes } from "@brainbot/shared/db";

const DASHBOARD_URL = process.env.WEB_DASHBOARD_URL ?? "https://your-web-host/dashboard";

/**
 * Parse deep-link payloads:
 * - "st_<token>"       → Start token (could be base64url JSON or JWT)
 * - "drill_<topicEnc>" → Drill topic (URI-encoded)
 * - otherwise          → null
 */
function extractPayload(ctx: Context):
  | { kind: "start"; token: string }
  | { kind: "drill"; topic: string }
  | null {
  const payload = (ctx as any)?.startPayload as string | undefined;
  const text: string = (ctx as any)?.message?.text ?? "";
  const parts = text.split(" ").filter(Boolean);

  const raw = payload ?? (parts.length >= 2 ? parts[1] : undefined);
  if (!raw) return null;

  if (raw.startsWith("st_")) return { kind: "start", token: raw };
  if (raw.startsWith("drill_")) {
    const enc = raw.slice("drill_".length);
    try {
      return { kind: "drill", topic: decodeURIComponent(enc) };
    } catch {
      // tolerate non-encoded legacy payloads
      return { kind: "drill", topic: enc.replace(/_/g, " ") };
    }
  }
  return null;
}

/** Safe base64url → JSON parser. Returns null if not valid base64url JSON. */
function tryParseBase64UrlJson(input: string): any | null {
  try {
    const json = Buffer.from(input, "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

type StartJsonPayload = { wid?: string; plan?: string };

export function registerStart(bot: Telegraf<Context>) {
  bot.start(async (ctx) => {
    const parsed = extractPayload(ctx);
    const tid = Number(ctx.from?.id);
    const name = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ");

    // No payload → gentle guidance
    if (!parsed) {
      await ctx.reply(
        `👋 Hi ${name || "there"}!\nUse the website to start a session and auto-link, or type /session to begin here.`
      );
      return;
    }

    // Deep-link into drill flow directly
    if (parsed.kind === "drill") {
      await startDrill(ctx, parsed.topic);
      return;
    }

    // Normal start token flow
    const token = parsed.token; // e.g., "st_<something>"
    const raw = token.slice(3); // drop "st_"

    // 1) Try base64url(JSON) path: {"wid","plan"}
    const maybeJson = tryParseBase64UrlJson(raw) as StartJsonPayload | null;

    if (maybeJson?.wid && tid) {
      try {
        const db = await getDb();
        await ensureUserLinksIndexes(db);
        const col = userLinks(db);

        const wid = String(maybeJson.wid);
        const plan = typeof maybeJson.plan === "string" ? maybeJson.plan : undefined;

        const res = await col.updateOne(
          { wid },
          {
            $set: {
              telegramId: tid,
              linkedAt: new Date(),
              updatedAt: new Date(),
            },
            ...(plan ? { $setOnInsert: { planHint: plan } } : {}),
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true }
        );

        const already =
          res.matchedCount > 0 &&
          // if it matched and didn't modify (telegramId already set), treat as already
          (res.modifiedCount === 0);

        if (already) {
          await ctx.reply("✅ Already linked — welcome back!");
        } else {
          await ctx.reply("✅ Linked successfully! You can now upload your answers and type /finish when done.");
        }

        await ctx.reply(`Open your dashboard here:\n${DASHBOARD_URL}`, {
          link_preview_options: { is_disabled: true },
        });
        return;
      } catch (err: any) {
        // If DB path fails unexpectedly, fall back to JWT confirm flow as a safety net
        console.error("Base64url linking failed; falling back to confirmLink:", err);
      }
    }

    // 2) Fallback: treat as JWT and confirm with web
    try {
      const result = await confirmLinkOnWeb(token, tid);

      if (result.ok) {
        if (result.already) {
          await ctx.reply("✅ Already linked — welcome back!");
        } else {
          await ctx.reply("✅ Linked successfully! You can now upload your answers and type /finish when done.");
        }
        await ctx.reply(`Open your dashboard here:\n${DASHBOARD_URL}`, {
          link_preview_options: { is_disabled: true },
        });
      } else {
        await ctx.reply("❌ Couldn’t verify your link. Open the website and generate a fresh link.");
      }
    } catch (err: any) {
      const msg = String(err?.message || err);
      await ctx.reply(`⚠️ Linking failed: ${msg}\nGenerate a new link from the website and try again.`);
    }
  });
}
