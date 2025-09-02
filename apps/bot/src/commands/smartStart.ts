import { Telegraf, Markup } from "telegraf";
import type { Context } from "telegraf";
import { getCollections } from "../lib/db.js";
import {
  SUBJECTS,
  CORE_LABELS,
  slugByLabel,
  labelBySlug,
  type SubjectSlug,
  type SubjectLabel,
} from "../data/subjectsCatalog.js";
import { getUserTier, PLAN_LIMITS } from "../lib/plan.js";
import * as PlanLib from "../lib/plan.js";
import { ensureUserExists } from "../utils/ensureUser.js";

/* ---------- helpers ---------- */
function pickDefaultLang(code?: string | null): Extract<SubjectSlug, "eng" | "kis"> {
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

async function setFocus(telegramId: string, slug: SubjectSlug) {
  const { users } = await getCollections();
  await ensureUserExists(telegramId);
  await users.updateOne(
  { telegramId },
  {
    $set: {
      "profile.focusSubject": slug,
      updatedAt: new Date(),          // <— merged here
    },
    $setOnInsert: { createdAt: new Date() },
  },
  { upsert: true }
);
}


function nonNull<T>(x: T | null | undefined): x is T { return x !== null && x !== undefined; }
function isSubjectLabel(s: string): s is SubjectLabel { return slugByLabel.has(s as unknown as SubjectLabel); }

async function getTrialUsed(telegramId: string): Promise<number> {
  const anyLib = PlanLib as Record<string, any>;
  if (typeof anyLib.getTotalSessionsUsed === "function") {
    return await anyLib.getTotalSessionsUsed(telegramId);
  }
  return 0;
}

/** Smart recommendation (free: Math → Eng/Kis; paid: rotate cores) */
async function pickRecommended(ctx: Context): Promise<{ slug: SubjectSlug; label: string }> {
  try {
    const { telegramId, u } = await readProfile(ctx);
    const tier = await getUserTier(ctx);

    if (tier === "free") {
      const usedTotal = await getTrialUsed(telegramId);
      if (usedTotal <= 0) return { slug: "mat", label: labelBySlug.get("mat") || "Mathematics" };
      if (usedTotal === 1) {
        const lang = pickDefaultLang((ctx.from as any)?.language_code);
        return { slug: lang, label: labelBySlug.get(lang) || (lang === "kis" ? "Kiswahili" : "English") };
      }
    }

    const chosenLabels: string[] = Array.isArray(u?.profile?.subjects) ? u!.profile!.subjects : [];
    if (!chosenLabels.length) {
      const def = SUBJECTS.find(s => s.slug === "eng") ?? SUBJECTS[0];
      return { slug: def.slug as SubjectSlug, label: def.label };
    }

    const { usage } = await getCollections();
    const recent = await usage.find({ telegramId }).sort({ ts: -1 }).limit(200).toArray();
    const lastSeenByLabel = new Map<string, number>();
    for (const r of recent as Array<{ subjectLabel?: string; ts?: Date }>) {
      const lab = r.subjectLabel as string | undefined;
      if (lab && !lastSeenByLabel.has(lab)) lastSeenByLabel.set(lab, r.ts?.getTime?.() ?? 0);
    }

    const inChosen = (lab: string) => chosenLabels.includes(lab);

    const corePickLabel =
      CORE_LABELS.find((c: string) => inChosen(c) && !lastSeenByLabel.has(c)) ??
      CORE_LABELS.filter(inChosen).sort((a: string, b: string) => (lastSeenByLabel.get(a) ?? 0) - (lastSeenByLabel.get(b) ?? 0))[0];

    if (corePickLabel && isSubjectLabel(corePickLabel)) {
      const s = slugByLabel.get(corePickLabel as SubjectLabel);
      if (nonNull(s)) return { slug: s as SubjectSlug, label: corePickLabel };
    }

    const anyPickLabel =
      [...chosenLabels].sort((a: string, b: string) => (lastSeenByLabel.get(a) ?? 0) - (lastSeenByLabel.get(b) ?? 0))[0] ?? chosenLabels[0];

    if (anyPickLabel && isSubjectLabel(anyPickLabel)) {
      const anySlug = slugByLabel.get(anyPickLabel as SubjectLabel);
      if (nonNull(anySlug)) return { slug: anySlug as SubjectSlug, label: anyPickLabel };
    }

    const def = SUBJECTS.find(s => s.slug === "eng") ?? SUBJECTS[0];
    return { slug: def.slug as SubjectSlug, label: def.label };
  } catch {
    const def = SUBJECTS.find(s => s.slug === "eng") ?? SUBJECTS[0];
    return { slug: def.slug as SubjectSlug, label: def.label };
  }
}

function smartKb(slug?: SubjectSlug) {
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
type CtxFn = (c: Context) => Promise<any>;

export function registerSmartStart(bot: Telegraf) {
  // Get Session (no slug)
  bot.action("DO_QUICK", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const rec = await pickRecommended(ctx);
    const { telegramId } = await readProfile(ctx);
    await setFocus(telegramId, rec.slug);
    await ctx.deleteMessage().catch(() => {});
    const { startStudyForSubject } = await import("./study.js");
    await (startStudyForSubject as unknown as CtxFn)(ctx);
  });

  // Get Session with explicit slug
  bot.action(/^DO_QUICK:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const slug = String((ctx.match as any)[1]) as SubjectSlug;
    const { telegramId } = await readProfile(ctx);
    await setFocus(telegramId, slug);
    await ctx.deleteMessage().catch(() => {});
    const { startStudyForSubject } = await import("./study.js");
    await (startStudyForSubject as any)(ctx as any, slug);
  });

  // Switch Subject
  bot.action("SWITCH_QUICK", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const { u } = await readProfile(ctx);
    const chosenLabels: string[] = Array.isArray(u?.profile?.subjects) ? u!.profile!.subjects : [];

    if (!chosenLabels.length) {
      const subjMod = await import("./subjects.js");
      return (subjMod.openSubjectPicker as unknown as CtxFn)(ctx);
    }

    const slugs: SubjectSlug[] = chosenLabels
      .filter(isSubjectLabel)
      .map((lab) => slugByLabel.get(lab as SubjectLabel))
      .filter(nonNull) as SubjectSlug[];

    const take = slugs.slice(0, 9);
    const rows: any[] = [];
    for (let i = 0; i < take.length; i += 3) {
      rows.push(
        take.slice(i, i + 3).map((sg: SubjectSlug) =>
          Markup.button.callback(labelBySlug.get(sg) || sg.toUpperCase(), `START_SUBJ:${sg}`)
        )
      );
    }
    rows.push([Markup.button.callback("🧰 Open Picker", "OPEN_PICKER")]);

    await ctx.reply("Pick a subject to start now:", Markup.inlineKeyboard(rows));
  });

  bot.action("OPEN_PICKER", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const subjMod = await import("./subjects.js");
    await (subjMod.openSubjectPicker as unknown as CtxFn)(ctx);
  });

  bot.action(/^START_SUBJ:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const slug = String((ctx.match as any)[1]) as SubjectSlug;
    const { telegramId } = await readProfile(ctx);
    await setFocus(telegramId, slug);
    await ctx.deleteMessage().catch(() => {});
    const { startStudyForSubject } = await import("./study.js");
    await (startStudyForSubject as any)(ctx as any, slug);
  });

  bot.action("OPEN_PLAN", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const tier = await getUserTier(ctx);
    const { u } = await readProfile(ctx);
    const subs: string[] = Array.isArray(u?.profile?.subjects) ? u!.profile!.subjects : [];

    if (tier === "free") {
      const total = (PLAN_LIMITS.free as any).trialTotalSessions ?? 2;
      const used = await getTrialUsed(String(ctx.from?.id || ""));
      const left = Math.max(0, total - used);
      const lines = [
        `📅 *Smart Plan* — Free Starter`,
        `• You have *${left}/${total}* trial sessions left.`,
        `• Start with *Mathematics*, then *English* or *Kiswahili*.`,
        ``,
        `Tap *Get Session* to continue.`,
      ];
      const nextSlug: SubjectSlug =
        used === 0 ? "mat" : used === 1 ? pickDefaultLang((ctx.from as any)?.language_code) : "eng";
      return ctx.reply(lines.join("\n"), { parse_mode: "Markdown", ...smartKb(nextSlug) });
    }

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
    if (!picks.length) picks.push("English");

    picks.forEach((s) => lines.push(`• ${s}`));

    const firstLabel = picks[0] ?? "English";
    const firstSlug = (isSubjectLabel(firstLabel) ? slugByLabel.get(firstLabel) : "eng") as SubjectSlug;

    await ctx.reply(lines.join("\n"), {
      parse_mode: "Markdown",
      ...smartKb(firstSlug),
    });
  });
}

