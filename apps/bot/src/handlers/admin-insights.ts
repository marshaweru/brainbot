// apps/bot/src/handlers/admin-insights.ts
import type { Telegraf } from "telegraf";
import { addTips, getInsight, upsertInsight } from "../repo/insightsRepo.js";
import * as sessionRepo from "../repo/sessionRepo.js";

const ADMIN_IDS = (process.env.ADMIN_IDS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

function isAdmin(tgId: string) {
  return ADMIN_IDS.includes(tgId);
}

function splitOnce(s: string, sep = "|"): [string, string] {
  const i = s.indexOf(sep);
  if (i < 0) return [s.trim(), ""];
  return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
}

/**
 * Syntax:
 *   /insight_set <subject>|<topic> | tip1 ; tip2 ; tip3
 *   /insight_add <subject>|<topic> | extra tip A ; extra tip B
 *   /insight_get <subject>|<topic>
 * If <subject> omitted, we try to infer from active session.
 */
export function registerAdminInsights(bot: Telegraf) {
  bot.command(["insight_set", "insight_add", "insight_get"], async (ctx) => {
    const tgId = String(ctx.from?.id ?? "");
    if (!isAdmin(tgId)) return ctx.reply("Unauthorized.");

    const text = (ctx.message as any)?.text || "";
    const [cmd, ...rest] = text.trim().split(/\s+/);
    const raw = rest.join(" ").trim();
    if (!raw) {
      return ctx.reply([
        "Usage:",
        "/insight_get <subject>|<topic>",
        "/insight_set <subject>|<topic> | tip1 ; tip2 ; tip3",
        "/insight_add <subject>|<topic> | extra tip A ; extra tip B",
        "",
        "If subject omitted, I’ll use your active session’s subject.",
      ].join("\n"));
    }

    // parse subject|topic [| tips…]
    const [lhs, rhs] = splitOnce(raw, "|");
    let subject = lhs.includes("|") ? lhs.split("|")[0].trim() : ""; // safety, but lhs is everything before first |
    let topic = lhs.includes("|") ? lhs.split("|").slice(1).join("|").trim() : lhs.trim();

    let tipsStr = rhs;
    // If there are two pipes: <subject>|<topic>|tips…
    if (!tipsStr && raw.includes("|")) {
      const parts = raw.split("|");
      if (parts.length >= 3) {
        subject = parts[0].trim();
        topic = parts[1].trim();
        tipsStr = parts.slice(2).join("|").trim();
      }
    }

    if (!subject) {
      // infer subject from active session
      try {
        const active = await sessionRepo.getActiveByTelegramId(tgId);
        subject = (active?.subjectLabel as any) || "";
      } catch {}
    }

    subject = subject || "Mathematics";
    if (!topic) return ctx.reply("Missing topic.");

    // actions
    if (cmd === "/insight_get") {
      const hit = await getInsight(subject, topic);
      if (!hit) return ctx.reply(`No insight yet for ${subject} / ${topic}.`);
      const tips = (hit.tips ?? []).map((t, i) => `${i + 1}. ${t}`).join("\n");
      return ctx.reply(
        [
          `📌 Insight for ${subject} / ${topic}`,
          tips || "(empty)",
        ].join("\n")
      );
    }

    const tips = (tipsStr || "")
      .split(";")
      .map(s => s.trim())
      .filter(Boolean);

    if (!tips.length) return ctx.reply("Provide tips after the last '|', separated by ';'.");

    if (cmd === "/insight_add") {
      await addTips(subject, topic, tips);
      return ctx.reply(`Added ${tips.length} tip(s) to ${subject} / ${topic}.`);
    }

    // /insight_set
    await upsertInsight({ subject, topic, tips, source: "admin", quality: 80 });
    return ctx.reply(`Set ${tips.length} tip(s) for ${subject} / ${topic}.`);
  });
}
