import { Telegraf, Context } from "telegraf";
import { connectDB, getCollections } from "../lib/db.js";
import type { TierCode, SubjectSlug } from "../prompts/system.js";
import { renderMarkdownToPdf } from "../lib/pdf.js";
import { generateSession, SUBJECT_LABELS } from "../lib/session.js";

/* utils --------------------------------------------------------------- */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** Map human labels → SubjectSlug */
const SUBJECT_TO_SLUG: Record<string, SubjectSlug> = {
  mathematics: "mat",
  maths: "mat",
  math: "mat",
  english: "eng",
  kiswahili: "kis",
  swahili: "kis",
  biology: "bio",
  chemistry: "chem",
  physics: "phy",
  "general science": "gsc",
  "history & government": "his",
  history: "his",
  geography: "geo",
  cre: "cre",
  french: "fr",
  german: "ger",
  arabic: "arb",
};
function toSlug(label: string): SubjectSlug {
  const k = (label || "").trim().toLowerCase();
  return SUBJECT_TO_SLUG[k] ?? "mat";
}

/* parse /dev session <subject> [quick|weak|drill] [topic…] ------------- */
type Mode = "quick" | "weak" | "drill";
function parseSessionArgs(text: string): { subject: string; mode: Mode; topic?: string } {
  const m = text.match(/\/dev\s+session\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))(?:\s+(quick|weak|drill))?(?:\s+(.*))?$/i);
  const subject = (m?.[1] || m?.[2] || m?.[3] || "Mathematics").trim();
  const mode = ((m?.[4] || "quick").toLowerCase() as Mode);
  const topic = m?.[5]?.trim() || undefined;
  return { subject, mode, topic };
}

/* command wiring ------------------------------------------------------- */
export function registerDev(bot: Telegraf<Context>) {
  const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID || process.env.TG_ADMIN_ID || "";

  bot.command("dev", async (ctx) => {
    if (ADMIN_ID && String(ctx.from?.id) !== ADMIN_ID) return;

    const text = (ctx.message?.text || "").trim();
    const [, sub = ""] = text.split(/\s+/);

    const telegramId = ctx.from!.id.toString();

    /* reset daily counters (legacy) */
    if (sub === "reset") {
      const db = await connectDB();
      await db.collection("daily_counters").deleteMany({ telegramId, date: todayKey() });
      return ctx.reply("🧪 Dev: today’s plan counters reset.");
    }

    /* set plan tier quickly */
    if (sub === "tier") {
      const tier = (text.split(/\s+/)[2] as TierCode) || "premium";
      const { users } = await getCollections();
      await users.updateOne(
        { telegramId },
        { $set: { "plan.tier": tier, updatedAt: new Date() } },
        { upsert: true }
      );
      return ctx.reply(`🧪 Dev: tier set to *${tier}*`, { parse_mode: "Markdown" });
    }

    /* ------- PDF self-test ------- */
    if (sub === "pdf-selftest" || sub === "pdf") {
      try {
        const md = [
          "# BrainBot PDF Self-Test",
          "",
          `- Timestamp: ${new Date().toISOString()}`,
          `- Out dir: \`${process.env.PDF_OUT_DIR || "(default)"}\``,
          "",
          "If you can read this in a PDF, the renderer is alive ✅",
        ].join("\n");

        const { filePath, filename } = await renderMarkdownToPdf(md, "BrainBot • PDF Self-Test");
        await ctx.replyWithDocument(
          { source: filePath, filename },
          { caption: "🧪 PDF self-test complete" }
        );
      } catch (e: any) {
        return ctx.reply(`❌ PDF self-test failed: ${e?.message || e}`);
      }
      return;
    }

    /* ------- Session generator smoke test ------- */
    if (sub === "session") {
      const { subject, mode, topic } = parseSessionArgs(text);
      const slug = toSlug(subject);
      const label = SUBJECT_LABELS[slug] || subject;

      try {
        const res = await generateSession({ subject: slug, label, topic, tier: "premium" });

        await ctx.reply(
          `🧪 *Dev Session*\nSubject: *${label}* (${slug})\nMode: *${mode}*` + (topic ? `\nTopic: _${topic}_` : ""),
          { parse_mode: "Markdown" }
        );

        await ctx.reply(res.content, { parse_mode: "Markdown" });

        // Attach a PDF, best-effort
        try {
          const { filePath, filename } = await renderMarkdownToPdf(res.content, `${label} — Dev Session`);
          await ctx.replyWithDocument({ source: filePath, filename }, { caption: "⬇️ PDF attached" });
        } catch (e: any) {
          await ctx.reply(`(PDF render skipped: ${e?.message || e})`);
        }
      } catch (e: any) {
        return ctx.reply(`❌ Session generation failed: ${e?.message || e}`);
      }
      return;
    }

    /* help */
    return ctx.reply(
      [
        "Dev cmds:",
        "• `/dev reset` – clear today’s minutes/subjects",
        "• `/dev tier <lite|pro|serious|premium>` – set plan tier",
        "• `/dev pdf-selftest` – render a 1-page PDF and send it",
        "• `/dev session <subject> [quick|weak|drill] [topic…]`",
        "   e.g., `/dev session Mathematics drill`",
        "         `/dev session \"History & Government\" weak Causes of WWI`",
      ].join("\n"),
      { parse_mode: "Markdown" }
    );
  });
}
