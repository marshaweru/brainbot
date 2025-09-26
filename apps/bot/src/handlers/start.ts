// apps/bot/src/handlers/start.ts
import type { Context } from "telegraf";
import { Telegraf } from "telegraf";
import { confirmLinkOnWeb } from "../services/confirmLink.js";
import { startDrill } from "./drills.js";
import { getDb, userLinks } from "@brainbot/shared/db";

const DASHBOARD_URL = process.env.WEB_DASHBOARD_URL ?? "https://your-web-host/dashboard";

// --- move this to your bot bootstrap (index.ts), run once on startup ---
// const db = await getDb(); await ensureUserLinksIndexes(db);

// Narrow ctx.startPayload safely
function getStartPayload(ctx: Context): string | undefined {
  const any = ctx as any;
  return typeof any.startPayload === "string" ? any.startPayload : undefined;
}

function extractPayload(ctx: Context):
  | { kind: "start"; token: string }
  | { kind: "drill"; topic: string }
  | null {
  const payload = getStartPayload(ctx);
  const text = String((ctx as any)?.message?.text ?? "");
  const parts = text.split(/\s+/).filter(Boolean);
  const raw = payload ?? (parts.length >= 2 ? parts[1] : undefined);
  if (!raw) return null;

  if (raw.startsWith("st_")) return { kind: "start", token: raw };
  if (raw.startsWith("drill_")) {
    const enc = raw.slice("drill_".length);
    try { return { kind: "drill", topic: decodeURIComponent(enc) }; }
    catch { return { kind: "drill", topic: enc.replace(/_/g, " ") }; }
  }
  return null;
}

function tryParseBase64UrlJson(input: string): unknown | null {
  try { return JSON.parse(Buffer.from(input, "base64url").toString("utf8")); }
  catch { return null; }
}

type StartJsonPayload = { wid?: string; plan?: string };

export function registerStart(bot: Telegraf<Context>) {
  bot.start(async (ctx) => {
    const parsed = extractPayload(ctx);
    const tid = Number(ctx.from?.id);
    const name = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ");

    if (!parsed) {
      await ctx.reply(`👋 Hi ${name || "there"}!\nUse the website to start a session and auto-link, or type /session to begin here.`);
      return;
    }

    if (parsed.kind === "drill") {
      await startDrill(ctx, parsed.topic);
      return;
    }

    const token = parsed.token;             // "st_<...>"
    const raw = token.slice(3);             // drop "st_"
    const maybeJson = tryParseBase64UrlJson(raw) as StartJsonPayload | null;

    if (maybeJson?.wid && tid) {
      try {
        const db = await getDb();
        const col = userLinks(db);
        const wid = String(maybeJson.wid);
        const plan = typeof maybeJson.plan === "string" ? maybeJson.plan : undefined;

        const res = await col.updateOne(
          { wid },
          {
            $set: { telegramId: tid, linkedAt: new Date(), updatedAt: new Date() },
            ...(plan ? { $setOnInsert: { planHint: plan } } : {}),
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true }
        );

        const already = res.matchedCount > 0 && res.modifiedCount === 0;
        await ctx.reply(already ? "✅ Already linked — welcome back!" : "✅ Linked successfully! You can now upload your answers and type /finish when done.");
        await ctx.reply(`Open your dashboard here:\n${DASHBOARD_URL}`, { link_preview_options: { is_disabled: true } });
        return;
      } catch (err) {
        console.error("Base64url linking failed; falling back to confirmLink:", err);
      }
    }

    try {
      const result = await confirmLinkOnWeb(token, tid);
      if (result.ok) {
        await ctx.reply(result.already ? "✅ Already linked — welcome back!" : "✅ Linked successfully! You can now upload your answers and type /finish when done.");
        await ctx.reply(`Open your dashboard here:\n${DASHBOARD_URL}`, { link_preview_options: { is_disabled: true } });
      } else {
        await ctx.reply("❌ Couldn’t verify your link. Open the website and generate a fresh link.");
      }
    } catch (err: any) {
      await ctx.reply(`⚠️ Linking failed: ${String(err?.message || err)}\nGenerate a new link from the website and try again.`);
    }
  });
}
