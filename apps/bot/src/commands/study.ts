// apps/bot/src/commands/study.ts
import { Context, Markup } from "telegraf";
import { getCollections } from "../lib/db";
import { sendSmartStart } from "./smartStart";
import { openSubjectPicker } from "./subjects";
import { SUBJECTS, labelBySlug } from "../data/subjectsCatalog";

import {
  SYSTEM_PROMPT,
  buildSessionUserPrompt,
  sessionMaxTokens,
  textModelForTier,            // explicit model
  type SubjectSlug,
  type TierCode,
} from "../prompts/system";
import { chatComplete } from "../lib/openai";
import { mdToPdf } from "../lib/pdf";

import { estimateTokensByChars } from "../utils/tokenBudget";
import {
  getUserTier,
  getTotalSubjectsUsed,
  minutesPerSession,
  reserveSession,
} from "../lib/plan";

const SAMPLE_TOPIC: Record<string, string> = {
  eng: "Comprehension + Summary (Paper 1)",
  kis: "Insha: Hoja vs Riwaya (Paper 1/2)",
  mat: "Quadratics & Graphs (P1 high frequency)",
  phy: "Force & Pressure (P1) → Graphs (P2)",
  chem: "Acids, Bases & Salts → Titration (P3)",
  bio: "Cell Structure → Respiration",
  geo: "Map-work → Settlement & Land Use",
  his: "Pre-colonial societies → Colonial rule",
  cre: "Christian Ethics → Leadership",
  gsc: "Mixtures, Heat, Electricity basics",
  fr: "Compréhension + Grammaire",
  ger: "Lesen + Grammatik",
  arb: "صرف و نحو (Sarf & Nahw)",
  bst: "Demand & Supply → Ledgers",
  cst: "Algorithms → Flowcharts",
  agr: "Soil Science → Crop Production",
  hme: "Nutrition → Food Science",
  wdw: "Tools & Safety → Joints",
  mtl: "Benchwork → Welding",
  elc: "Ohm’s law → Circuits",
  pwm: "Engines → Power transmission",
};

// Map plan-tier → our TierCode (for prompts)
function toTierCode(t: unknown): TierCode {
  const s = String(t || "").toLowerCase();
  if (["club84","ultra","ultra_plus","premium","premium_plus"].includes(s)) return "club84";
  if (["serious","plus","serious_prep","month_plus"].includes(s)) return "serious";
  if (s === "pro" || s === "week") return "pro";
  return "lite";
}

// Map unknown slugs to a nearest supported SubjectSlug
function coerceToSubjectSlug(slug: string): SubjectSlug {
  const supported: SubjectSlug[] = ["eng","kis","mat","bio","chem","phy","gsc","his","geo","cre","fr","ger","arb"];
  if (supported.includes(slug as SubjectSlug)) return slug as SubjectSlug;
  const map: Record<string, SubjectSlug> = {
    bst: "geo", cst: "mat", agr: "bio", hme: "chem", wdw: "phy", mtl: "phy", elc: "phy", pwm: "phy",
  };
  return (map[slug] ?? "mat") as SubjectSlug;
}

async function recordUsage(ctx: Context, slug: string, tokens = 0, pdfPath?: string) {
  try {
    const { usage } = await getCollections();
    const telegramId = ctx.from?.id?.toString()!;
    await usage.insertOne({
      telegramId,
      subjectSlug: slug,
      subjectLabel: labelBySlug.get(slug) || slug,
      ts: new Date(),
      tokens,
      pdfPath,
    });
  } catch (e) {
    console.error("[study] recordUsage error:", (e as any)?.message || e);
  }
}

function sessionButtons() {
  const rows: any[] = [
    [Markup.button.callback("✅ Mark My Work", "MARK_UPLOAD")],
    [
      Markup.button.callback("🔁 Switch Subject", "SWITCH_QUICK"),
      Markup.button.callback("📅 Plan", "OPEN_PLAN"),
    ],
  ];
  return Markup.inlineKeyboard(rows);
}

function durationHintFor(minutes: number): "2h" | "3h" | "5h" | "8h" {
  if (minutes >= 420) return "8h";
  if (minutes >= 270) return "5h";
  if (minutes >= 150) return "3h";
  return "2h";
}

function upgradeButtons() {
  return Markup.inlineKeyboard([
    [Markup.button.url("🌐 See Plans", "https://yourdomain.xyz/pricing")],
    [Markup.button.callback("Not now", "CLOSE")],
  ]);
}

async function startStudyForSubject(ctx: Context, slug: string) {
  const label = labelBySlug.get(slug) || "Selected Subject";
  const hint = SAMPLE_TOPIC[slug] || "High-frequency topics & KCSE-style drills";

  // figure tier + reservation policy
  const effectiveTier = await getUserTier(ctx);            // "free" | paid tiers
  const tierCode: TierCode = toTierCode(effectiveTier);    // for prompts/models
  const minutes = effectiveTier === "free" ? 0 : minutesPerSession(effectiveTier);

  // enforce plan limits up-front
  const reservation = await reserveSession(ctx, slug, minutes);
  if (!reservation.ok) {
    if (reservation.reason === "trial_exhausted") {
      await ctx.reply(
        "🎁 You’ve used your *2 free sessions*. Unlock full access to keep studying today.",
        { parse_mode: "Markdown", ...upgradeButtons() }
      );
      return;
    }
    if (reservation.reason === "subjects") {
      await ctx.reply(
        "📚 You’ve reached today’s *subject limit* for your plan.\nUpgrade to study more subjects today.",
        { parse_mode: "Markdown", ...upgradeButtons() }
      );
      return;
    }
    if (reservation.reason === "minutes") {
      await ctx.reply(
        "⏳ You’ve used today’s *study time* for your plan.\nUpgrade for more time.",
        { parse_mode: "Markdown", ...upgradeButtons() }
      );
      return;
    }
    return;
  }

  // banner
  const banner =
    `⭐ *${label}* — recommended focus.\n` +
    `Today’s starter: _${hint}_\n\n` +
    `I’ll send examinable notes + a KCSE-style mini-quiz.\n` +
    `When you finish, tap “Mark My Work”.`;
  await ctx.reply(banner, { parse_mode: "Markdown" });

  // 🔥 Generate session
  let content = "";
  let pdfPath: string | undefined;
  try {
    const subjectSlug = coerceToSubjectSlug(slug);
    const durHint = durationHintFor(minutes);
    const paperFocus = subjectSlug === "chem" ? "P3" : "Mixed";

    const maxTokens = sessionMaxTokens(subjectSlug, tierCode);
    // TS target is ES2020 → use regex replace instead of replaceAll
    const sys = SYSTEM_PROMPT.replace(/SESSION_MAX_TOKENS/g, String(maxTokens));

    const model = textModelForTier(tierCode);
    const messages = [
      { role: "system" as const, content: sys },
      { role: "user"   as const, content: buildSessionUserPrompt({ subject: subjectSlug, topic: hint, durationHint: durHint, paperFocus }) },
    ];

    const resp = await chatComplete({
      model,
      messages,
      maxTokens,
      temperature: 0.9,
    });

    content = resp.content;

    // Send Markdown + buttons
    await ctx.reply(content, { parse_mode: "Markdown", ...sessionButtons() });

    // Generate & send PDF
    pdfPath = await mdToPdf(content);
    await ctx.replyWithDocument(
      { source: pdfPath, filename: `${label}-Session.pdf` },
      { caption: "📄 Download your session as PDF" }
    );

    // token accounting
    const tokens = estimateTokensByChars(content);
    const { usage } = await getCollections();
    const date = new Date().toISOString().slice(0, 10);
    await usage.updateOne(
      { telegramId: String(ctx.from?.id), date },
      { $inc: { tokens }, $set: { updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );

    await recordUsage(ctx, slug, tokens, pdfPath);

    // 🎯 Free trial: if this was the second session, nudge upgrade immediately
    if (effectiveTier === "free") {
      const used = await getTotalSubjectsUsed(String(ctx.from?.id || ""));
      if (used >= 2) {
        await ctx.reply(
          "🎉 Nice work! You’ve finished your *2 free sessions*. Ready to keep going?",
          { parse_mode: "Markdown", ...upgradeButtons() }
        );
      }
    }
  } catch (e) {
    console.error("[study] session generation error:", (e as any)?.message || e);
    await ctx.reply("Session generation hiccuped. Try again in a moment or switch subject.");
    await recordUsage(ctx, slug, estimateTokensByChars(content));
  }
}

export default async function studyCmd(ctx: Context) {
  const telegramId = ctx.from?.id?.toString();
  if (!telegramId) return;

  const { users } = await getCollections();
  const u = await users.findOne(
    { telegramId },
    { projection: { "profile.focusSubject": 1, "profile.subjects": 1 } }
  );

  const hasSubjects = Array.isArray(u?.profile?.subjects) && u!.profile!.subjects.length > 0;

  if (!hasSubjects) {
    await ctx.reply("Let’s pick your KCSE subjects first. It’s quick!");
    await openSubjectPicker(ctx);
    return;
  }

  const slug = (u?.profile?.focusSubject as string | undefined) || "";
  const isValid = !!SUBJECTS.find((s) => s.slug === slug);

  if (!isValid) {
    try {
      await sendSmartStart(ctx);
    } catch (e) {
      console.error("[study] smart start error:", (e as any)?.message || e);
      await ctx.reply("Quick start failed — opening subject picker.");
      await openSubjectPicker(ctx);
    }
    return;
  }

  await startStudyForSubject(ctx, slug);
}
