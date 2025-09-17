// apps/bot/src/services/pdf-export.ts
import type { Context } from "telegraf";
import { getLatestFeedback } from "../state/latest.js";
import { buildFeedbackPDF } from "./pdfkit-report.js";

export async function offerExportPdf(ctx: Context) {
  try {
    await ctx.reply("Want a PDF report of this session?", {
      reply_markup: { inline_keyboard: [[{ text: "📄 Export PDF", callback_data: "export_pdf" }]] },
    });
  } catch (err) {
    console.error("offerExportPdf failed:", err);
  }
}

// normalize to string[] for PDF layer
const toStrings = (arr: any): string[] =>
  Array.isArray(arr)
    ? arr.map((x) => (typeof x === "string" ? x : x?.topic ?? x?.name ?? String(x)))
    : [];

// normalize Date | string | unknown → string | undefined
const toISO = (v: unknown): string | undefined => {
  if (!v) return undefined;
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
};

export async function generatePdfNow(ctx: Context) {
  try {
    const telegramId = String(ctx.from?.id ?? "");
    const latest = getLatestFeedback(telegramId);
    if (!latest) return ctx.reply("No feedback found for this session.");

    const buf = await buildFeedbackPDF({
      telegramId,
      subjectLabel: latest.subjectLabel || "General",
      score: latest.score,
      gradeText: latest.gradeText,
      weakTopics: toStrings(latest.weakTopics),
      remarks: latest.remarks,
      startedAt: toISO(latest.startedAt),
      finishedAt: toISO(latest.finishedAt),
      plan: latest.plan,
    });

    await ctx.replyWithDocument({ source: buf, filename: "BrainBot-Report.pdf" });
  } catch (err) {
    console.error("generatePdfNow failed:", err);
    await ctx.reply("Couldn’t create the PDF right now.");
  }
}
