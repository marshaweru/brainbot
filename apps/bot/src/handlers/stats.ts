// apps/bot/src/handlers/stats.ts
import { Telegraf } from "telegraf";
import { buildUserStats, HeatItem, TrendPoint, buildTopSubjects } from "../services/analytics";

export function registerStatsHandlers(bot: Telegraf) {
  bot.command("stats", async (ctx) => {
    const uid = String(ctx.from?.id ?? "");
    const text = (ctx.message as any)?.text || "";
    const [, ...rest] = text.trim().split(/\s+/);

    // Support: /stats top  OR  /stats Math
    const first = (rest[0] || "").toLowerCase();
    const isTop = first === "top";

    try {
      if (isTop) {
        const list = await buildTopSubjects(uid, { minSessions: 2 });
        if (!list.length) return ctx.reply("Not enough sessions yet to compute top subjects. Do a few papers first.");
        const top3 = list.slice(0, 3);
        const lines = top3.map((s, i) =>
          `${i + 1}. ${s.subjectLabel}: Δ ${fmtDelta(s.delta)} (first ${s.first} → latest ${s.latest}, ${s.count} sessions)`
        );
        return ctx.reply(["🏅 Best Improving Subjects", ...lines].join("\n"));
      }

      // Otherwise: normal stats, optional subject filter
      const subjectArg = rest.join(" ").trim() || null;
      const { trend, heat, consistency, streakDays, subjectLabel } = await buildUserStats(uid, { subject: subjectArg });
      const scope = subjectLabel ? ` (${subjectLabel})` : "";

      const lastN = 20;
      const recent = trend.slice(0, lastN).map(t => t.grade).reverse();
      const line = recent.length ? sparkline(recent) : "—";

      const sessionsCount = trend.length;
      const latest: TrendPoint | undefined = trend[0];
      const latestStr = latest
        ? `${latest.grade}% (${latest.subjectLabel}) on ${latest.date}`
        : "—";

      const top: HeatItem[] = heat.slice(0, 5);
      const heatLine =
        top.length > 0
          ? top.map((h: HeatItem) => `${h.topic} (${h.count})`).join(", ")
          : "None — you’re cruising 😎";

      await ctx.reply(
        [
          `📈 Your Study Stats${scope}`,
          `• Sessions: ${sessionsCount}`,
          `• Latest grade: ${latestStr}`,
          `• Consistency (14d): ${consistency}%`,
          `• Streak: ${streakDays} day${streakDays === 1 ? "" : "s"}`,
          `• Trend: ${line}`,
          `• Top weak topics: ${heatLine}`,
          "",
          subjectLabel
            ? "Tip: Try /drill <topic> hard or /notes <topic> for this subject."
            : "Tip: Filter by subject: /stats Math, /stats English. Or see growth: /stats top",
        ].join("\n")
      );
    } catch (err: any) {
      await ctx.reply(`Couldn’t build stats: ${String(err?.message || err)}`);
    }
  });
}

function fmtDelta(n: number) {
  const s = n >= 0 ? `+${n}` : `${n}`;
  return `${s} pts`;
}

/** Unicode sparkline using 0..100 normalized values. */
function sparkline(values: number[]): string {
  const nums = values.map(v => Math.max(0, Math.min(100, v)));
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const levels = ["▁","▂","▃","▄","▅","▆","▇","█"];
  if (!Number.isFinite(min) || !Number.isFinite(max) || nums.length === 0) return "—";
  if (max === min) return levels[0].repeat(nums.length);
  return nums.map(v => {
    const norm = (v - min) / (max - min);
    const idx = Math.min(levels.length - 1, Math.floor(norm * (levels.length - 1)));
    return levels[idx];
  }).join("");
}
