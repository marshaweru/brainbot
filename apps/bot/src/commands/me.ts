// apps/bot/src/commands/me.ts
import { Context, Markup } from "telegraf";
import { getCollections } from "../lib/db.js";
import { ensureDailyReset, fmtDate } from "../utils/daily.js";
import { getVoicePrefs } from "../utils/prefs.js";
import { getFreeState } from "../lib/free.js"; // NEW

function kcseDaysLeft(profile?: any) {
  try {
    const now = new Date();
    const y = profile?.examYear && profile.examYear >= now.getFullYear()
      ? profile.examYear
      : now.getFullYear();
    const target = new Date(y, 10, 15); // mid-Nov (month index 10)
    const ms = target.getTime() - now.getTime();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  } catch { return null; }
}

export default async function (ctx: Context) {
  const telegramId = ctx.from?.id?.toString();
  if (!telegramId) return ctx.reply("😬 Couldn’t read your Telegram ID. Try again.");

  const { users } = await getCollections();
  let user = await users.findOne({ telegramId });
  if (!user) return ctx.reply("👋 Type /start to set up your BrainBot profile.");

  const updated = await ensureDailyReset(users as any, user as any);
  if (updated) user = await users.findOne({ telegramId });

  const plan = user?.plan || null;
  const tier: string = plan?.tier || "free";
  const today = user?.daily || { minutesUsed: 0, subjectsDone: 0 };
  const expires = plan?.expiresAt ? new Date(plan.expiresAt) : null;

  // KCSE countdown
  const dLeft = kcseDaysLeft(user?.profile);

  // per-user voice prefs
  const voice = await getVoicePrefs(telegramId);
  const voiceStatus = voice.tts ? "ON" : "OFF";
  const langLabel = voice.lang === "en" ? "English" : voice.lang === "sw" ? "Kiswahili" : "auto";
  const voiceLine = `🎧 *Voice:* ${voiceStatus} — ${voice.tts ? "Voice + Text" : "Text only"} (lang: ${langLabel})`;

  const lines: string[] = [];

  // Header
  lines.push("👤 *Your BrainBot Status*");
  if (dLeft !== null) lines.push(`⏳ *KCSE:* ${dLeft} day${dLeft === 1 ? "" : "s"} left`);

  if (tier === "free") {
    // Free intro — sessions-based
    const free = await getFreeState(telegramId).catch(() => ({ remaining: 0, subjects: [] as string[] }));
    const used = 2 - (free?.remaining ?? 0);
    lines.push(`📦 *Plan:* Free Starter — *2 free sessions*`);
    lines.push(`✅ *Used:* ${used}/2 sessions`);
    lines.push(`💡 Next: Start with *Mathematics*, then *English* or *Kiswahili*.`);
  } else {
    // Paid — show daily allowances if present
    const hoursPerDay = plan?.hoursPerDay ?? null;
    const subjectsPerDay = plan?.subjectsPerDay ?? null;

    lines.push(`📦 *Plan:* ${plan?.label ?? "Active"} (${plan?.code ?? tier})`);
    if (hoursPerDay || subjectsPerDay) {
      const minsCap = hoursPerDay ? hoursPerDay * 60 : undefined;
      const minsUsed = today.minutesUsed || 0;
      const minsLeft = minsCap ? Math.max(0, minsCap - minsUsed) : undefined;
      lines.push(
        `📅 *Daily:*` +
          (hoursPerDay ? ` ⏱️ ${hoursPerDay}h` : "") +
          (subjectsPerDay ? ` • 📚 ${subjectsPerDay} subjects/day` : "")
      );
      lines.push(
        `✅ *Today:* ${today.subjectsDone || 0}${subjectsPerDay ? `/${subjectsPerDay}` : ""} subject(s)` +
          (minsCap ? ` • ${Math.floor(minsUsed)}’ used${minsLeft !== undefined ? ` (${minsLeft}’ left)` : ""}` : "")
      );
    } else {
      lines.push(`✅ *Today:* ${today.subjectsDone || 0} subject(s) done`);
    }
    lines.push(`🗓️ *Expires:* ${expires ? fmtDate(expires) : "—"}`);
  }

  lines.push(voiceLine);
  lines.push("", `⭐ *Next:* tap a button below.`);

  // Buttons
  const kb: any[] = [];
  kb.push([Markup.button.callback("📘 Get Session", "START_SESSION")]);
  kb.push([Markup.button.callback("📤 Upload for Marking (photos/PDF)", "MARK_UPLOAD")]);
  kb.push([Markup.button.callback("⚙️ Voice Settings", "VOICE_OPEN")]);

  if (tier === "free") {
    kb.push([Markup.button.url("🔥🔥 FOUNDER’S OFFER 🔥🔥", "https://brainbot-4jqh.onrender.com/pricing#founder")]);
    kb.push([Markup.button.url("🌐 Open Pricing", "https://brainbot-4jqh.onrender.com/pricing")]);
  }

  await ctx.reply(lines.join("\n"), {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard(kb),
  });
}
