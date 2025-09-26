import type { Context } from "telegraf";
import { Telegraf } from "telegraf";
import { markAnswer } from "../services/marking-service.js";
import { llm } from "../lib/llm.js";

/**
 * Usage (two forms):
 * A) Single line: /mark <subject> | <paper> | <questionRef> | <marksTotal> | <answer here>
 * B) Multiline: first line has pipes, remaining lines are the student's answer body.
 */
function parseMark(text: string) {
  const after = text.replace(/^\/mark(@\w+)?\s*/i, "");
  const lines = after.split("\n");
  const head = lines[0];
  const headParts = head.split("|").map(s => s.trim());
  const tail = lines.slice(1).join("\n").trim();

  const subject = headParts[0] || "Mathematics";
  const paper = headParts[1] || "Paper 2";
  const questionRef = headParts[2] || "Q1(a)";
  const marksTotal = Number(headParts[3] || 10);
  const studentAnswer = tail || headParts.slice(4).join(" | ");

  return { subject, paper, questionRef, marksTotal, studentAnswer };
}

export function registerMark(bot: Telegraf) {
  bot.command("mark", async (ctx: Context) => {
    try {
      const text = (ctx.message as any)?.text ?? "";
      const { subject, paper, questionRef, marksTotal, studentAnswer } = parseMark(text);

      const res = await markAnswer({
        subject, paper, questionRef, studentAnswer, marksTotal,
        opts: { llm, syllabus_ids_json: "[]", ms_ids_json: "[]" }
      });

      const top = `📝 Marking — ${subject} • ${paper} • ${questionRef}\nMarks: ${res.marks.awarded}/${res.marks.total}`;
      const breakdown = res.breakdown.slice(0, 4)
        .map(b => `• ${b.step}: +${b.award}/${b.outOf} (${b.reason})`).join("\n");
      const errors = res.errors.slice(0, 3)
        .map(e => `× ${e.type}: ${e.detail} — ${e.penalty}`).join("\n");
      const note = res.examinerNote ? `\n\nNote: ${res.examinerNote}` : "";

      await ctx.reply([top, breakdown && `\nBreakdown:\n${breakdown}`, errors && `\nErrors:\n${errors}`, note]
        .filter(Boolean).join("\n"));
    } catch (e: any) {
      await ctx.reply(`Couldn’t mark that answer: ${e?.message ?? "unknown error"}`);
    }
  });
}
