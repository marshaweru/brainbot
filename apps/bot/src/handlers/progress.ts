import { Telegraf } from "telegraf";
import { getScoresTimeline } from "../repo/performanceRepo.js";
import { buildProgressSVG, sparkline } from "../services/progress-chart.js";

const ADMIN_IDS = (process.env.ADMIN_IDS || "").split(",").map(s => s.trim()).filter(Boolean);
const isAdmin = (id: string) => ADMIN_IDS.includes(id);

// Paper colors
const PAPER_COLORS: Record<string, string> = {
  "1": "#2563eb", // blue
  "2": "#16a34a", // green
  "3": "#dc2626", // red
};

export function registerProgressHandlers(bot: Telegraf) {
  // /progress [subject words...] [--days=90] [--user=123456] [--nolabels] [--every=K] [--dense]
  bot.command("progress", async (ctx) => {
    try {
      const me = String(ctx.from?.id ?? "");
      const text = (ctx.message as any)?.text || "";
      const [, ...rest] = text.trim().split(/\s+/);

      let subject = "";
      let days: number | undefined;
      let user = me;
      let showLabels = true;
      let labelEvery: number | undefined;

      
      const flags = rest.filter((x: string) => x.startsWith("--"));
      const words = rest.filter((x: string) => !x.startsWith("--"));
      for (const f of flags) {
        if (f.startsWith("--days=")) days = Math.max(1, Math.min(365, Number(f.split("=")[1] || 90)));
        if (f === "--nolabels") showLabels = false;
        if (f === "--dense") labelEvery = 1;                 // show every label
        if (f.startsWith("--every=")) labelEvery = Math.max(1, parseInt(f.split("=")[1] || "3", 10));
        if (f.startsWith("--user=")) {
          const cand = f.split("=").slice(1).join("=");      // support ids with =
          if (cand && isAdmin(me)) user = cand;
        }
      }
      subject = words.join(" ");

      const timeline = await getScoresTimeline(user, {
        subjectLabel: subject || undefined,
        sinceDays: days ?? 180,
      });

      if (!timeline.length) {
        return ctx.reply(
          subject
            ? `No scores yet for "${subject}" in the selected window. Try submitting a paper or broaden the range with <code>--days=365</code>.`
            : `No scores yet in the selected window. Do a session, then run <code>/progress</code> again.`,
          { parse_mode: "HTML" }
        );
      }

      const xs = timeline.map(p => p.when);
      const ys = timeline.map(p => p.score);

      // Labels: Paper • % • YYYY-MM-DD with color by paper number
      const labels = timeline.map(p => {
        const paperRaw = (p.paper || "").toString().trim();
        const paperNum = paperRaw.replace(/[^123]/g, "") || "?";
        const tag = paperNum === "?" ? "—" : `P${paperNum}`;
        const pct = `${Math.round(Number(p.score ?? 0))}%`;
        const date = new Date(p.when).toISOString().slice(0, 10);
        const text = `${tag} • ${pct} • ${date}`;
        const color = PAPER_COLORS[paperNum] || "#666";
        return { text, color, opacity: color === "#666" ? 0.6 : 0.9 };
      });

      const title =
        (user !== me ? `User ${user} — ` : "") +
        (subject ? `${subject} • ` : "") +
        `Last ${days ?? 180} days`;

      const svg = buildProgressSVG(xs, ys, { title, labels, showLabels, labelEvery });
      const ascii = sparkline(ys);

      await ctx.reply(
        [
          `📈 <b>Progress</b> ${subject ? `— <i>${escapeHtml(subject)}</i>` : ""}`,
          `Points: ${ys.length} • Range: ${Math.min(...ys)} → ${Math.max(...ys)}`,
          `Spark: <code>${ascii}</code>`,
          ``,
          `Color key: P1 (blue) • P2 (green) • P3 (red)`,
          `Tips:`,
          `• Filter subject: <code>/progress Mathematics</code>`,
          `• Change window: <code>/progress --days=365</code>`,
          `• Labels every 3rd (default). Show all: <code>/progress --dense</code>`,
          `• Custom thinning: <code>/progress --every=4</code>`,
          `• Hide labels: <code>/progress --nolabels</code>`,
          ...(isAdmin(me) ? [`• Admin target: <code>/progress --user=${user} Mathematics --days=365</code>`] : []),
        ].join("\n"),
        { parse_mode: "HTML" }
      );

      await ctx.replyWithDocument(
        { source: svg, filename: "progress.svg" },
        { caption: "Progress chart (SVG)", parse_mode: "HTML" }
      );
    } catch (err: any) {
      await ctx.reply(`Couldn’t build progress: ${String(err?.message || err)}`);
    }
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (ch) =>
    ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&quot;"
  );
}
