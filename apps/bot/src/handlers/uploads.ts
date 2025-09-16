// apps/bot/src/handlers/uploads.ts
import { Telegraf, Context } from "telegraf";
import { sessionAddUpload, getActiveByTelegramId } from "../repo/sessionRepo";
import { buildUploadPath, saveUpload, ensureDir } from "../lib/files";
import path from "path";
import fs from "fs";

/* ---------------- helpers ---------------- */

type WindowState =
  | { state: "exam"; msg?: string }
  | { state: "upload"; msg: string }
  | { state: "closed"; msg: string };

function windowState(active: any): WindowState {
  const now = Date.now();
  const examEnds = active?.examEndsAt ? new Date(active.examEndsAt).getTime() : 0;
  const uploadEnds = active?.uploadEndsAt ? new Date(active.uploadEndsAt).getTime() : 0;

  if (uploadEnds && now > uploadEnds) {
    return { state: "closed", msg: "⛔ Session window is closed. Start a new one with /session." };
  }
  if (examEnds && now > examEnds) {
    const minsLeft = Math.max(0, Math.ceil((uploadEnds - now) / 60000));
    return { state: "upload", msg: `⏫ Exam window ended. You're in the 30-min upload window (${minsLeft} min left).` };
  }
  const preset = active?.examPreset === "2h30" ? "2h 30m" : "2h";
  return { state: "exam", msg: `⏱ Exam window (${preset}).` };
}

function getSessionId(active: any): string | null {
  return String(active?._id ?? active?.id ?? active?.sessionId ?? "") || null;
}

async function downloadFileBuffer(ctx: Context, fileId: string): Promise<Buffer> {
  const link = await ctx.telegram.getFileLink(fileId); // URL or { href }
  const url = String((link as any).href ?? link);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch file ${fileId} (HTTP ${res.status})`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

/* --------------- registrar --------------- */

export function registerUploads(bot: Telegraf) {
  // Photos
  bot.on("photo", async (ctx) => {
    const photos = ctx.message?.photo;
    if (!photos?.length) return;

    const active = await getActiveByTelegramId(String(ctx.from!.id));
    const sid = getSessionId(active);
    if (!sid) return ctx.reply("No active session. Start with /session.");

    const phase = windowState(active);
    if (phase.state === "closed") return ctx.reply(phase.msg);

    const largest = photos[photos.length - 1];
    const fileId = largest.file_id;

    const buf = await downloadFileBuffer(ctx, fileId);
    const dest = buildUploadPath(ctx.from!.id, sid, "photo", `${fileId}.jpg`);
    await saveUpload(buf, dest);

    const payload = {
      kind: "photo" as const,
      fileId,
      mimeType: "image/jpeg",
      caption: (ctx.message as any).caption || "",
      localPath: dest,
      receivedAt: new Date().toISOString(),
      late: phase.state === "upload",
    };

    await sessionAddUpload(ctx.from!.id, payload);
    await ctx.reply(
      phase.state === "upload"
        ? "📸 Photo saved. (Upload window — answers won’t count for time-based analytics.)"
        : "📸 Photo saved to your session.",
    );
  });

  // Voice
  bot.on("voice", async (ctx) => {
    const v = ctx.message?.voice;
    if (!v) return;

    const active = await getActiveByTelegramId(String(ctx.from!.id));
    const sid = getSessionId(active);
    if (!sid) return ctx.reply("No active session. Start with /session.");

    const phase = windowState(active);
    if (phase.state === "closed") return ctx.reply(phase.msg);

    const fileId = v.file_id;
    const buf = await downloadFileBuffer(ctx, fileId);
    const dest = buildUploadPath(ctx.from!.id, sid, "voice", `${fileId}.ogg`);
    await saveUpload(buf, dest);

    const payload = {
      kind: "voice" as const,
      fileId,
      mimeType: v.mime_type || "audio/ogg",
      duration: v.duration,
      localPath: dest,
      receivedAt: new Date().toISOString(),
      late: phase.state === "upload",
    };

    await sessionAddUpload(ctx.from!.id, payload);
    await ctx.reply(
      phase.state === "upload"
        ? "🎤 Voice saved. (Upload window — answers won’t count for time-based analytics.)"
        : "🎤 Voice saved to your session.",
    );
  });

  // Documents
  bot.on("document", async (ctx) => {
    const d = ctx.message?.document;
    if (!d) return;

    const active = await getActiveByTelegramId(String(ctx.from!.id));
    const sid = getSessionId(active);
    if (!sid) return ctx.reply("No active session. Start with /session.");

    const phase = windowState(active);
    if (phase.state === "closed") return ctx.reply(phase.msg);

    const fileId = d.file_id;
    const buf = await downloadFileBuffer(ctx, fileId);
    const ext = path.extname(d.file_name || "") || ".bin";
    const dest = buildUploadPath(ctx.from!.id, sid, "document", `${fileId}${ext}`);
    await saveUpload(buf, dest);

    const payload = {
      kind: "document" as const,
      fileId,
      mimeType: d.mime_type || "application/octet-stream",
      caption: d.file_name,
      localPath: dest,
      receivedAt: new Date().toISOString(),
      late: phase.state === "upload",
    };

    await sessionAddUpload(ctx.from!.id, payload);
    await ctx.reply(
      phase.state === "upload"
        ? "📄 Document saved. (Upload window — answers won’t count for time-based analytics.)"
        : `📄 Document (${d.file_name}) saved to your session.`,
    );
  });

  // Text answers
  bot.on("text", async (ctx) => {
    const text = (ctx.message as any).text?.trim();
    if (!text || text.startsWith("/")) return;

    const active = await getActiveByTelegramId(String(ctx.from!.id));
    const sid = getSessionId(active);
    if (!sid) return ctx.reply("No active session. Start with /session.");

    const phase = windowState(active);
    if (phase.state === "closed") return ctx.reply(phase.msg);

    const filename = `${Date.now()}.txt`;
    const dest = buildUploadPath(ctx.from!.id, sid, "text", filename);
    ensureDir(path.dirname(dest));
    fs.writeFileSync(dest, text, "utf8");

    const payload = {
      kind: "text" as const,
      text,
      localPath: dest,
      receivedAt: new Date().toISOString(),
      late: phase.state === "upload",
    };

    await sessionAddUpload(ctx.from!.id, payload);
    await ctx.reply(
      phase.state === "upload"
        ? "✍️ Text saved. (Upload window — answers won’t count for time-based analytics.)"
        : "✍️ Text answer saved to your session.",
    );
  });
}
