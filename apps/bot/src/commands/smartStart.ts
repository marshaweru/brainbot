// apps/bot/src/commands/smartStart.ts
import { Telegraf, Context, Markup } from "telegraf";
import { getCollections } from "../lib/db";
import {
  SUBJECTS,
  CORE_LABELS,
  slugByLabel,
  labelBySlug,
} from "../data/subjectsCatalog";
import {
  getUserTier,
  PLAN_LIMITS,
  getTotalSubjectsUsed,
} from "../lib/plan";

/* ---------- helpers ---------- */
function pickDefaultLang(code?: string | null): "eng" | "kis" {
  const c = (code || "").toLowerCase();
  return c.startsWith("sw") ? "kis" : "eng";
}

async function readProfile(ctx: Context) {
  const telegramId = ctx.from?.id?.toString()!;
  const { users } = await getCollections();
  const u = await users.findOne(
    { telegramId },
    { projection: { profile: 1, plan: 1 } }
  );
  return { telegramId, u };
}

async function setFocus(telegramId: string, slug: string) {
  const { users } = await getCollections();
  await users.updateOne(
    { telegramId },
    { $set: { "profile.focusSubject": slug, updatedAt: new Date() } },
    { upsert: true }
  );
}

/**
 * Smart recommendation:
 * - FREE tier (2-session trial):
 *    1) First = Mathematics
 *    2) Second = English or Kiswahili (based on Telegram language)
 * - PAID tiers: rotate fairly across chosen subjects (prefer core)
 */
async function pickRecommended(ctx: Context): Promise<{ slug: string; label: string }> {
  try {
    const { telegramId, u } = await readProfile(ctx);
    const tier = await getUserTier(ctx);

    // Free trial path — deterministic two-session flow
    if (tier === "free") {
      const usedTotal = await getTotalSubjectsUsed(telegramId);
      if (usedTotal <= 0) {
        return { slug: "mat", label: labelBySlug.get("mat") || "Mathematics" };
      }
      if (usedTotal === 1) {
        const lang = pickDefaultLang((ctx.from as any)?.language_code);
        return { slug: lang, label: labelBySlug.get(lang) || (lang === "kis" ? "Kiswahili" : "English") };
      }
      // After 2 sessions are done, just fall back to normal logic (or limits will block anyway)
    }

    // Paid (or fallback) — rotate across chosen subjects, prefer core subjects
    const chosen: string[] = Array.isArray(u?.profile?.subjects) ? u!.profile!.subjects : [];
    if (!chosen.length) {
      const def = SUBJECTS.find(s => s.slug === "eng") ?? SUBJECTS[0];
      return { slug: def.slug, label: def.label };
    }

    // Look at recent usage to rotate fairly
    const { usage } = await getCollections();
    const recent = await usage.find({ telegramId }).sort({ ts: -1 }).limit(200).toArray();
    const lastSeen = new Map<string, number>();
    for (const r of recent) {
      const lab = r.subjectLabel as string | undefined;
      if (lab && !lastSeen.has(lab)) lastSeen.set(lab, r.ts?.getTime?.() ?? 0);
    }

    const inChosen = (lab: string) => chosen.includes(lab);

    // Prefer a core that hasn't been done recently; otherwise least-recent overall
    const corePick =
      CORE_LABELS.find((c) => inChosen(c) && !lastSeen.has(c)) ??
      CORE_LABELS.filter(inChosen).sort((a, b) => (lastSeen.get(a) ?? 0) - (lastSeen.get(b) ?? 0))[0];

    if (corePick) return { slug: slugByLabel.get(corePick)!, label: corePick };

    const anyPick =
      [...chosen].sort((a, b) => (lastSeen.get(a) ?? 0) - (lastSeen.get(b) ?? 0))[0] ?? chosen[0];

    return { slug: slugByLabel.get(anyPick)!, label: anyPick };
  } catch {
    const def = SUBJECTS.find(s => s.slug === "eng") ?? SUBJECTS[0];
    return { slug: def.slug, label: def.label };
  }
}

function smartKb(slug?: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("⭐ Get Session", slug ? `DO_QUICK:${slug}` : "DO_QUICK")],
    [
      Markup.button.callback("🔁 Switch Subject", "SWITCH_QUICK"),
      Markup.button.callback("📅 Plan", "OPEN_PLAN"),
    ],
  ]);
}

/* ---------- public API ---------- */
export async function sendSmartStart(ctx: Context) {
  const tier = await getUserTier(ctx);
  const rec = await pickRecommended(ctx);

  if (tier === "free") {
    await ctx.reply(
      `⭐ Today: *${rec.label}* (trial)\n` +
      `Free Starter gives you *2 sessions total*. Begin with *Mathematics*, then *English* or *Kiswahili*.`,
      { parse_mode: "Markdown", ...smartKb(rec.slug) }
    );
    return;
  }

  await ctx.reply(
    `⭐ Today: *${rec.label}* — high-frequency focus.\nReady?`,
    { parse_mode: "Markdown", ...smartKb(rec.slug) }
  );
}

/* ---------- wiring ---------- */
export function registerSmartStart(bot: Telegraf) {
  // Get Session (no slug): pick recommended, set focus, then run study
  bot.action("DO_QUICK", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const rec = await pickRecommended(ctx);
    const { telegramId } = await readProfile(ctx);
    await setFocus(telegramId, rec.slug);
    await ctx.deleteMessage().catch(() => {});
    const { default: studyCmd } = await import("./study");
    await studyCmd(ctx);
  });

  // Get Session with explicit slug
  bot.action(/^DO_QUICK:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const slug = String(ctx.match[1]);
    const { telegramId } = await readProfile(ctx);
    await setFocus(telegramId, slug);
    await ctx.deleteMessage().catch(() => {});
    const { default: studyCmd } = await import("./study");
    await studyCmd(ctx);
  });

  // Switch Subject → show quick list of picked subjects, plus picker
  bot.action("SWITCH_QUICK", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const { u } = await readProfile(ctx);
    const chosen: string[] = Array.isArray(u?.profile?.subjects) ? u!.profile!.subjects : [];

    if (!chosen.length) {
      const { openSubjectPicker } = await import("./subjects");
      return openSubjectPicker(ctx);
    }

    const slugs = chosen.map((lab) => slugByLabel.get(lab)).filter(Boolean) as string[];
    const take = slugs.slice(0, 9);
    const rows: any[] = [];
    for (let i = 0; i < take.length; i += 3) {
      rows.push(
        take.slice(i, i + 3).map((sg) =>
          Markup.button.callback(labelBySlug.get(sg)!, `START_SUBJ:${sg}`)
        )
      );
    }
    rows.push([Markup.button.callback("🧰 Open Picker", "OPEN_PICKER")]);

    await ctx.reply("Pick a subject to start now:", Markup.inlineKeyboard(rows));
  });

  // Open full subject picker
  bot.action("OPEN_PICKER", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const { openSubjectPicker } = await import("./subjects");
    await openSubjectPicker(ctx);
  });

  // Start a specific subject immediately
  bot.action(/^START_SUBJ:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const slug = String(ctx.match[1]);
    const { telegramId } = await readProfile(ctx);
    await setFocus(telegramId, slug);
    await ctx.deleteMessage().catch(() => {});
    const { default: studyCmd } = await import("./study");
    await studyCmd(ctx);
  });

  // Lightweight daily plan:
  // - Free: explain 2 total sessions and compulsory flow (Math + Eng/Kis)
  // - Paid: show subjects/day (no minute talk) and suggest a rotation
  bot.action("OPEN_PLAN", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const tier = await getUserTier(ctx);
    const { u } = await readProfile(ctx);
    const subs: string[] = Array.isArray(u?.profile?.subjects) ? u!.profile!.subjects : [];

    if (tier === "free") {
      const total = PLAN_LIMITS.free.trialTotalSubjects || 2;
      const used = await getTotalSubjectsUsed(String(ctx.from?.id || ""));
      const left = Math.max(0, total - used);

      const lines = [
        `📅 *Smart Plan* — Free Starter`,
        `• You have *${left}/${total}* trial sessions left.`,
        `• Start with *Mathematics*, then *English* or *Kiswahili*.`,
        ``,
        `Tap *Get Session* to continue.`,
      ];
      const nextSlug = used === 0 ? "mat" : used === 1 ? pickDefaultLang((ctx.from as any)?.language_code) : "eng";
      return ctx.reply(lines.join("\n"), { parse_mode: "Markdown", ...smartKb(nextSlug) });
    }

    // Paid plans: prioritize subjects/day; rotate chosen subjects
    const limits = PLAN_LIMITS[tier];
    const subjectsPerDay = limits.subjectsPerDay;
    const lines = [
      `📅 *Smart Plan*`,
      `• Subjects per day: *${subjectsPerDay}*`,
      `• Selected subjects: *${subs.length || 0}*`,
      ``,
      `Suggested rotation (today):`,
    ];
    const picks = subs.slice(0, subjectsPerDay || 1);
    if (!picks.length) {
      picks.push("English"); // fallback
    }
    picks.forEach((s) => lines.push(`• ${s}`));

    const firstSlug = slugByLabel.get(picks[0] ?? "") || "eng";
    await ctx.reply(lines.join("\n"), {
      parse_mode: "Markdown",
      ...smartKb(firstSlug),
    });
  });
}
