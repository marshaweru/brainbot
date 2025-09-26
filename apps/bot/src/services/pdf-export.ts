// apps/bot/src/services/pdf-export.ts
import type { Context, Telegraf } from "telegraf";
import { getLatestFeedback } from "../state/latest.js";
import { buildFeedbackPDF } from "./pdfkit-report.js";

/** Inline prompt with one-tap export */
export async function offerExportPdf(ctx: Context) {
  try {
    await ctx.reply("Want a PDF report of this session?", {
      reply_markup: { inline_keyboard: [[{ text: "📄 Export PDF", callback_data: "export_pdf" }]] },
    });
  } catch (err) {
    console.error("offerExportPdf failed:", err);
  }
}

/** Wire the callback handler once during bootstrap */
export function registerPdfExportHandler(bot: Telegraf) {
  bot.action("export_pdf", async (ctx) => {
    try {
      await ctx.answerCbQuery("Building your report…");
      await generatePdfNow(ctx);
    } catch (err) {
      console.error("export_pdf action failed:", err);
      try { await ctx.answerCbQuery("Couldn’t create the PDF."); } catch {}
    }
  });
}

/* ---------------- helpers ---------------- */

// normalize to string[] for PDF layer
const toStrings = (arr: unknown): string[] =>
  Array.isArray(arr)
    ? arr
        .map((x) =>
          typeof x === "string"
            ? x
            : (x as any)?.topic ?? (x as any)?.name ?? (x != null ? String(x) : "")
        )
        .filter((s) => !!s && typeof s === "string")
    : [];

// normalize Date | string | unknown → ISO | undefined
const toISO = (v: unknown): string | undefined => {
  if (!v) return undefined;
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
};

function safeFilename(parts: Array<string | undefined>, ext = ".pdf") {
  const base = parts.filter(Boolean).join(" - ");
  const cleaned = base.replace(/[\/\\:*?"<>|]+/g, "_").slice(0, 120);
  return `${cleaned || "BrainBot-Report"}${ext}`;
}

/* ---------------- main ---------------- */

export async function generatePdfNow(ctx: Context) {
  const telegramId = String(ctx.from?.id ?? "");
  try {
    const latest = getLatestFeedback(telegramId);
    if (!latest) {
      return ctx.reply("No feedback found for this session.");
    }

    const subject = latest.subjectLabel || "General";
    const startedISO = toISO(latest.startedAt);
    const finishedISO = toISO(latest.finishedAt);

    const buf = await buildFeedbackPDF({
      telegramId,
      subjectLabel: subject,
      score: latest.score,
      gradeText: latest.gradeText,
      weakTopics: toStrings(latest.weakTopics),
      remarks: latest.remarks,
      startedAt: startedISO,
      finishedAt: finishedISO,
      plan: latest.plan,
    });

    // Hard guard: Telegram has ~50MB doc limit; yours should be tiny, but let’s be safe
    if (Buffer.isBuffer(buf) && buf.byteLength > 45 * 1024 * 1024) {
      console.warn("PDF exceeds size threshold:", buf.byteLength);
      await ctx.reply("Report is too large to send. Try narrowing the session or contact support.");
      return;
    }

    const dateStamp = (finishedISO || startedISO || "").slice(0, 10); // YYYY-MM-DD
    const filename = safeFilename(["BrainBot", subject, dateStamp]);

    await ctx.replyWithDocument(
      { source: buf as any, filename },
      // Optional caption with summary (kept short for Telegram)
      {
        caption:
          latest?.gradeText
            ? `BrainBot report — ${subject} • Grade: ${latest.gradeText}`
            : `BrainBot report — ${subject}`,
      }
    );
  } catch (err) {
    console.error("generatePdfNow failed:", err);
    await ctx.reply("Couldn’t create the PDF right now.");
  }
}
