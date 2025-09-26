// apps/bot/src/handlers/notes.ts
import { Telegraf, Markup } from "telegraf";
import { getNotes } from "../repo/notesRepo.js";
import * as sessionRepo from "../repo/sessionRepo.js";
import * as drillsRepo from "../repo/drillsRepo.js";
import { SUBJECTS } from "../subjects.js";
import { resolveTopic } from "../lib/topic-resolver.js";
import { startDrill } from "./drills.js";
import { getDrill } from "../services/drill-engine.js";

function normalizeSubjectLabel(input?: string | null): string | null {
  if (!input) return null;
  const lower = input.toLowerCase();
  const bySlug = (SUBJECTS as any[]).find((s) => s?.slug?.toLowerCase?.() === lower);
  if (bySlug) return bySlug.label ?? String(bySlug);
  const byLabel = (SUBJECTS as any[]).find((s) => s?.label?.toLowerCase?.() === lower);
  if (byLabel) return byLabel.label ?? String(byLabel);
  const byString = (SUBJECTS as any[]).find((s) => String(s).toLowerCase() === lower);
  return byString ? String(byString) : null;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (ch) =>
    ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&quot;"
  );
}

function makePreview(hit: any, max = 140): string | undefined {
  const raw = hit?.snippet ?? hit?.text ?? hit?.markdown ?? hit?.content ?? "";
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  // very light cleanup: strip markdown-ish artifacts
  const cleaned = raw
    .replace(/[_*`>#-]/g, "")   // strip basic md chars
    .replace(/\s+/g, " ")       // collapse whitespace
    .trim();
  return cleaned.length > max ? cleaned.slice(0, max - 1) + "…" : cleaned;
}

export function registerNotesHandlers(bot: Telegraf) {
  bot.command("notes", async (ctx) => {
    try {
      const text = (ctx.message as any)?.text || "";
      const [, ...rest] = text.trim().split(/\s+/);
      const rawTopic = rest.join(" ").trim();

      if (!rawTopic) {
        return ctx.reply(
          [
            "Usage: /notes <topic>",
            "Examples:",
            "• /notes Algebra",
            "• /notes Factorization",
            "",
            "Tip: Start a session with /session first so I auto-target your subject.",
          ].join("\n"),
          { link_preview_options: { is_disabled: true } as any }
        );
      }

      // Infer subject from active session (if any)
      const tgId = String(ctx.from?.id ?? "");
      let subjectLabel: string | null = null;
      try {
        const active = await sessionRepo.getActiveByTelegramId(tgId);
        subjectLabel = normalizeSubjectLabel(active?.subjectLabel ?? null);
      } catch { /* ignore */ }

      // Canonicalize topic via syllabus
      const { canonical, suggestion } = resolveTopic(subjectLabel ?? "Mathematics", rawTopic);
      if (!canonical) {
        return ctx.replyWithHTML(
          suggestion
            ? `Topic not found. Did you mean <b>${escapeHtml(suggestion)}</b>?\n` +
              `Try: <code>/notes ${escapeHtml(suggestion)}</code>`
            : `Topic not in the syllabus for <b>${escapeHtml(subjectLabel ?? "your subject")}</b>. ` +
              `Try a different topic or check spelling.`,
          { link_preview_options: { is_disabled: true } as any }
        );
      }
      const topic = canonical;

      // Lookup notes (subject-scoped, then widen)
      let notes = await getNotes(topic, subjectLabel ?? undefined);
      if ((!notes || notes.length === 0) && subjectLabel) {
        notes = await getNotes(topic, undefined);
      }
      if (!notes || notes.length === 0) {
        return ctx.reply(
          subjectLabel
            ? `No notes found for "${topic}" in ${subjectLabel} yet. Try a different topic.`
            : `No notes found for "${topic}". You can also run /session so I know your subject.`,
          { link_preview_options: { is_disabled: true } as any }
        );
      }

      // Header + PREVIEW ✨
      const hit = notes[0];
      const preview = makePreview(hit);
      const header =
        `📚 <b>KCSE Notes</b>\n` +
        `Subject: <b>${escapeHtml(subjectLabel ?? hit.subject ?? "—")}</b>\n` +
        `Topic: <b>${escapeHtml(hit.topic || topic)}</b>\n` +
        (preview ? `\n🧭 <i>${escapeHtml(preview)}</i>\n` : "\n");

      const enc = encodeURIComponent(hit.topic || topic);
      const kb = Markup.inlineKeyboard([
        [Markup.button.callback("📝 Drill (Normal)", `notes_drill:${enc}:normal`)],
        [
          Markup.button.callback("💪 Hard", `notes_drill:${enc}:hard`),
          Markup.button.callback("🔥 Insane", `notes_drill:${enc}:insane`),
        ],
        [Markup.button.callback("🔁 Repeat last", `notes_repeat:${enc}`)],
      ]);

      await ctx.reply(header, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true } as any,
        reply_markup: kb.reply_markup,
      });

      // Body content
      await ctx.reply(String((hit as any).markdown ?? (hit as any).text ?? "(No content)"), {
        link_preview_options: { is_disabled: true } as any,
      });

      // Extra matches (cap to 3)
      if (notes.length > 1) {
        const extra = notes
          .slice(1, 4)
          .map((n) => `• ${n.relpath ?? `${n.subject ?? ""} / ${n.topic ?? ""}`}`)
          .join("\n");
        await ctx.reply(`Found more matches:\n${extra}\n\n(Ask for a specific one by name if needed.)`, {
          link_preview_options: { is_disabled: true } as any,
        });
      }
    } catch (err: any) {
      await ctx.reply(`Couldn’t fetch notes: ${String(err?.message || err)}`, {
        link_preview_options: { is_disabled: true } as any,
      });
    }
  });

  // Drill buttons
  bot.action(/^notes_drill:([^:]+):(easy|normal|hard|insane)$/, async (ctx) => {
    try {
      const encTopic = ctx.match?.[1];
      const diff = ctx.match?.[2] || "normal";
      const topic = decodeURIComponent(encTopic || "");
      if (!topic) return ctx.answerCbQuery("Missing topic.");
      await ctx.answerCbQuery(`Generating ${diff} drill…`);
      await startDrill(ctx, topic, diff);
    } catch (err) {
      console.error("notes_drill action error:", err);
      try { await ctx.answerCbQuery("Couldn’t start drill."); } catch {}
    }
  });

  // Repeat last button
  bot.action(/^notes_repeat:([^:]+)$/, async (ctx) => {
    try {
      const telegramId = String(ctx.from?.id ?? "");
      const topic = decodeURIComponent(ctx.match?.[1] || "");
      if (!topic) return ctx.answerCbQuery("Missing topic.");

      let subject = "Mathematics";
      try {
        const active = await sessionRepo.getActiveByTelegramId(telegramId);
        subject = normalizeSubjectLabel(active?.subjectLabel ?? null) || subject;
      } catch { /* ignore */ }

      const latest = await drillsRepo.getLatestByTopic({ telegramId, subjectLabel: subject, topic });
      if (!latest) {
        await ctx.answerCbQuery();
        return ctx.reply(`No previous drill found for "${topic}" in ${subject}. Try 📝 Drill (Normal) instead.`);
      }

      const outOf = Array.isArray(latest.questions) ? latest.questions.length : (latest.outOf || 8);
      const diffStr = String((latest as any).difficulty || "normal").toLowerCase();
      const level = diffStr === "easy" ? 0 : diffStr === "normal" ? 1 : diffStr === "hard" ? 2 : 3;

      await ctx.answerCbQuery("Generating a fresh set…");
      const drill = await getDrill(subject, topic, outOf, level);

      const saved = await drillsRepo.createDrill({
        telegramId,
        subjectLabel: subject,
        topic,
        difficulty: diffStr as any,
        questions: (drill.questions || []).map((q: any) => ({ q: String(q.q ?? q.question ?? ""), a: q.a })),
        score: 0,
        outOf: (drill.questions || []).length,
      });

      const questions = (drill.questions || []).map((q: any, i: number) => `Q${i + 1}) ${q.q}`).join("\n\n");

      await ctx.reply(
        [
          `🔁 <b>Drill Again</b>`,
          `Subject: <b>${escapeHtml(subject)}</b>`,
          `Topic: <b>${escapeHtml(topic)}</b>`,
          `Difficulty: <i>${escapeHtml(diffStr)}</i>`,
          `ID: <code>${(saved as any)._id}</code>`,
          ``,
          questions || "(No questions generated.)",
        ].join("\n"),
        { parse_mode: "HTML" }
      );
    } catch (err) {
      console.error("notes_repeat action error:", err);
      try { await ctx.answerCbQuery("Couldn’t repeat."); } catch {}
    }
  });
}
