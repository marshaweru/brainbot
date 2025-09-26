// apps/bot/src/handlers/stats.ts
import { Telegraf } from "telegraf";
import { buildUserStats, type HeatItem, type TrendPoint, buildTopSubjects } from "../services/analytics.js";

const ADMIN_IDS = (process.env.ADMIN_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const isAdmin = (id: string) => ADMIN_IDS.includes(id);

export function registerStatsHandlers(bot: Telegraf) {
  const handler = async (ctx: any) => {
    const me = String(ctx.from?.id ?? "");
    const text = (ctx.message as any)?.text || "";
    const [, ...restRaw] = text.trim().split(/\s+/);

    // Flags: --user=<id> (admin only)
    const flags = restRaw.filter((t: string) => t.startsWith("--"));
    const args  = restRaw.filter((t: string) => !t.startsWith("--"));


    let targetId = me;
    for (const f of flags) {
      if (f.startsWith("--user=") && isAdmin(me)) {
        const cand = f.split("=").slice(1).join("="); // tolerate '=' in value
        if (cand) targetId = cand.trim();
      }
    }

    // Support: /stats top  OR  /stats Math  OR  /stats --user=12345 Math
    const first = (args[0] || "").toLowerCase();
    const isTop = first === "top";

    try {
      if (isTop) {
        const list = await buildTopSubjects(targetId, { minSessions: 2 });
        if (!list.length) {
          return ctx.reply(
            "Not enough sessions yet to compute top subjects. Do a few papers first."
          );
        }
        const top3 = list.slice(0, 3);
        const lines = top3.map(
          (s: any, i: number) =>
            `${i + 1}. <b>${esc(s.subjectLabel)}</b>: Δ ${fmtDelta(s.delta)} ` +
            `(first ${s.first} → latest ${s.latest}, ${s.count} sessions)`
        );
        return ctx.reply(
          ["🏅 <b>Best Improving Subjects</b>", ...lines].join("\n"),
          { parse_mode: "HTML" }
        );
      }

      // Otherwise: normal stats, optional subject filter (can be multi-word)
      const subjectArg = args.join(" ").trim() || null;

      const {
        trend,
        heat,
        consistency,
        streakDays,
        subjectLabel,
      }: {
        trend: TrendPoint[];
        heat: HeatItem[];
        consistency: number;
        streakDays: number;
        subjectLabel?: string | null;
      } = await buildUserStats(targetId, { subject: subjectArg });

      const scope = subjectLabel ? ` (<i>${esc(subjectLabel)}</i>)` : "";

      const lastN = 20;
      const recent = trend.slice(0, lastN).map((t) => Number(t.grade || 0)).reverse();
      const line = recent.length ? sparkline(recent) : "—";

      const sessionsCount = trend.length;
      const latest: TrendPoint | undefined = trend[0];
      const latestStr = latest
        ? `${Math.round(latest.grade)}% (${esc(latest.subjectLabel)}) on ${esc(latest.date)}`
        : "—";

      const top: HeatItem[] = heat.slice(0, 5);
      const heatLine =
        top.length > 0
          ? top.map((h: HeatItem) => `${esc(h.topic)} (${h.count})`).join(", ")
          : "None — you’re cruising 😎";

      const lines = [
        `📈 <b>Your Study Stats</b>${scope}${targetId !== me ? ` • <code>${targetId}</code>` : ""}`,
        `• Sessions: <b>${sessionsCount}</b>`,
        `• Latest grade: <b>${latestStr}</b>`,
        `• Consistency (14d): <b>${Math.round(consistency)}%</b>`,
        `• Streak: <b>${streakDays}</b> day${streakDays === 1 ? "" : "s"}`,
        `• Trend: <code>${line}</code>`,
        `• Top weak topics: ${heatLine}`,
        ``,
        subjectLabel
          ? `Tip: Drill the weak stuff — <code>/drill &lt;topic&gt; hard</code> or read <code>/notes &lt;topic&gt;</code>.`
          : `Tip: Filter by subject (<code>/stats Math</code>) or check growth: <code>/stats top</code>.`,
        `Pro move: visual chart → <code>/progress${subjectLabel ? " " + subjectLabel : ""}</code>`,
      ];

      await ctx.reply(lines.join("\n"), {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true } as any,
      });
    } catch (err: any) {
      await ctx.reply(`Couldn’t build stats: ${String(err?.message || err)}`);
    }
  };

  bot.command("stats", handler);
  bot.command("mystats", handler); // convenient alias
}

/* ---------- helpers ---------- */

function fmtDelta(n: number) {
  const s = n >= 0 ? `+${n}` : `${n}`;
  return `${s} pts`;
}

/** Unicode sparkline using 0..100 normalized values. */
function sparkline(values: number[]): string {
  const nums = values.map((v) => Math.max(0, Math.min(100, Number(v) || 0)));
  if (!nums.length) return "—";
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const levels = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
  if (!Number.isFinite(min) || !Number.isFinite(max)) return "—";
  if (max === min) return levels[0].repeat(nums.length);
  return nums
    .map((v) => {
      const norm = (v - min) / (max - min);
      const idx = Math.min(levels.length - 1, Math.floor(norm * (levels.length - 1)));
      return levels[idx];
    })
    .join("");
}

function esc(s: string) {
  return String(s).replace(/[&<>"]/g, (ch) =>
    ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&quot;"
  );
}
