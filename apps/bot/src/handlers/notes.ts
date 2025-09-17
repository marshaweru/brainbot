// apps/bot/src/handlers/notes.ts
import { Telegraf } from "telegraf";
import { getNotes } from "../repo/notesRepo.js";
import * as sessionRepo from "../repo/sessionRepo.js";
import { SUBJECTS } from "../subjects.js";

function normalizeSubjectLabel(input?: string | null): string | null {
  if (!input) return null;
  const lower = input.toLowerCase();
  const bySlug = (SUBJECTS as any[]).find(s => s?.slug?.toLowerCase?.() === lower);
  if (bySlug) return bySlug.label ?? String(bySlug);
  const byLabel = (SUBJECTS as any[]).find(s => s?.label?.toLowerCase?.() === lower);
  if (byLabel) return byLabel.label ?? String(byLabel);
  const byString = (SUBJECTS as any[]).find(s => String(s).toLowerCase() === lower);
  return byString ? String(byString) : null;
}

export function registerNotesHandlers(bot: Telegraf) {
  bot.command("notes", async (ctx) => {
    try {
      const text = (ctx.message as any)?.text || "";
      const [, ...rest] = text.trim().split(/\s+/);
      const topic = rest.join(" ").trim();

      if (!topic) {
        return ctx.reply(
          [
            "Usage: /notes <topic>",
            "Examples:",
            "• /notes Algebra",
            "• /notes Factorization",
            "",
            "Tip: Start a session with /session first so I auto-target your subject.",
          ].join("\n")
        );
      }

      // Infer subject from active session (if any)
      const tgId = String(ctx.from?.id ?? "");
      let subjectLabel: string | null = null;
      try {
        const active = await sessionRepo.getActiveByTelegramId(tgId);
        subjectLabel = normalizeSubjectLabel(active?.subjectLabel ?? null);
      } catch {
        /* ignore */
      }

      const notes = await getNotes(topic, subjectLabel);
      if (!notes.length) {
        return ctx.reply(
          subjectLabel
            ? `No notes found for "${topic}" in ${subjectLabel} yet. Try a different topic.`
            : `No notes found for "${topic}". You can also run /session so I know your subject.`
        );
      }

      // Send first match with HTML header, no link preview
      const hit = notes[0];
      const header =
        `📚 <b>KCSE Notes</b>\n` +
        `Subject: <b>${escapeHtmlForHeader(subjectLabel ?? hit.subject ?? "—")}</b>\n` +
        `Topic: <b>${escapeHtmlForHeader(hit.topic)}</b>\n\n`;

      await ctx.reply(header, {
        parse_mode: "HTML",
        // New Bot API way; supported by recent telegraf types
        link_preview_options: { is_disabled: true },
      });

      // Body as plain text (Markdown/HTML in md is not parsed here)
      await ctx.reply(hit.markdown);

      // If there are more matches, hint them
      if (notes.length > 1) {
        const extra = notes.slice(1, 4).map(n => `• ${n.relpath}`).join("\n");
        await ctx.reply(
          `Found more matches:\n${extra}\n\n(Ask for a specific one by name if needed.)`
        );
      }
    } catch (err: any) {
      await ctx.reply(`Couldn’t fetch notes: ${String(err?.message || err)}`);
    }
  });
}

function escapeHtmlForHeader(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
