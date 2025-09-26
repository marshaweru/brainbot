// apps/bot/src/handlers/lesson-plan.ts
import type { Context } from "telegraf";
import { Telegraf } from "telegraf";
import type { LessonPlan } from "../services/lesson-plan-service.js";
import { generateLessonPlan } from "../services/lesson-plan-service.js";
import { llm } from "../lib/llm.js";

/** Parse "/lessonplan <subject> | <topic> | [level]" */
function parseLessonPlanArgs(text: string): { subject: string; topic: string; level: string } {
  const afterCmd = text.replace(/^\/lessonplan(@\w+)?\s*/i, "");
  const parts = afterCmd
    .split("|")
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0);

  const subject: string = parts[0] ?? "Mathematics";
  const topic: string = parts[1] ?? "Quadratic Equations";
  const level: string = parts[2] ?? "KCSE";
  return { subject, topic, level };
}

/** Format a LessonPlan to a compact Telegram message */
function formatLessonPlan(plan: LessonPlan): string {
  const coreLine: string = plan.core
    .map((s: LessonPlan["core"][number]) => `${s.step} (${s.durationMin}m)`)
    .join(" | ");

  const assessmentLine: string =
    plan.assessment.map((a: LessonPlan["assessment"][number]) => a.check).join("; ") || "—";

  return [
    `📘 Lesson Plan — ${plan.subject} › ${plan.topic} (${plan.level})`,
    `Objectives: ${plan.objectives.join("; ") || "—"}`,
    `Starter: ${plan.starter || "—"}`,
    `Core: ${coreLine || "—"}`,
    `Assessment: ${assessmentLine}`,
    `HW: ${plan.homework || "—"}`,
    `Note: ${plan.teacherNotes || "—"}`,
  ].join("\n");
}

export function registerLessonPlan(bot: Telegraf): void {
  bot.command("lessonplan", async (ctx: Context): Promise<void> => {
    try {
      const text: string = (ctx.message as any)?.text ?? "";
      const { subject, topic, level } = parseLessonPlanArgs(text);

      const plan: LessonPlan = await generateLessonPlan({ subject, topic, level, llm });
      await ctx.reply(formatLessonPlan(plan));
    } catch (err) {
      const msg: string =
        err instanceof Error ? `Couldn’t generate a lesson plan: ${err.message}` : "Couldn’t generate a lesson plan right now.";
      await ctx.reply(msg);
    }
  });
}
