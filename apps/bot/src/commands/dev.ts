// apps/bot/src/commands/dev.ts
import { Telegraf, Context } from "telegraf";
import { connectDB, getCollections } from "../lib/db";
import type { Tier } from "../lib/plan";
import { renderMarkdownToPdf } from "../lib/pdf";
import { generateSession } from "../lib/session";
import { spawn } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";

/* utils */
function todayKey() { return new Date().toISOString().slice(0, 10); }

/* ---- tiny copies of the python/worker resolvers (debug-only) ---- */
function splitCmd(cmd: string) {
  const parts = (cmd || "").trim().split(/\s+/).filter(Boolean);
  return { cmd: parts[0], args: parts.slice(1) };
}

async function detectPythonCmd(): Promise<{ cmd: string; args: string[]; source: string; }> {
  const envBin = process.env.PYTHON_BIN?.trim();
  const candidates = envBin
    ? [envBin]
    : process.platform === "win32"
    ? ["py -3", "python", "python3"]
    : ["python3", "python"];

  for (const cand of candidates) {
    const { cmd, args } = splitCmd(cand);
    try {
      await new Promise<void>((res, rej) => {
        const p = spawn(cmd, [...args, "--version"], { stdio: "ignore", shell: false });
        p.on("error", rej);
        p.on("close", (code) => (code === 0 ? res() : rej(new Error(String(code)))));
      });
      return { cmd, args, source: envBin ? "env:PYTHON_BIN" : "auto" };
    } catch { /* try next */ }
  }
  // fallback guess; may still fail, but we'll report it
  return {
    cmd: process.platform === "win32" ? "python" : "python3",
    args: [],
    source: "fallback",
  };
}

function resolveWorkerPath() {
  // compiled file lives at dist/commands/dev.js → worker at ../lib/../pdf_worker/md_to_pdf.py
  // debug uses the same resolution logic as pdf.ts (relative to __dirname under dist)
  return path.resolve(__dirname, "..", "pdf_worker", "md_to_pdf.py");
}

async function pythonVersionStr(cmd: string, args: string[]) {
  return new Promise<string>((resolve) => {
    const p = spawn(cmd, [...args, "--version"], { shell: false });
    let out = "";
    p.stdout.on("data", (d) => (out += String(d)));
    p.stderr.on("data", (d) => (out += String(d)));
    p.on("close", () => resolve(out.trim()));
    p.on("error", () => resolve("(failed to run --version)"));
  });
}

/* ---- /dev session arg parser ----
   Usage forms it supports:
   /dev session Mathematics
   /dev session Mathematics drill
   /dev session "History & Government" weak
   /dev session "History & Government" quick Electromagnetism graphs
*/
type Mode = "quick" | "weak" | "drill";
function parseSessionArgs(text: string): { subject: string; mode: Mode; topic?: string } {
  const m = text.match(/\/dev\s+session\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))(?:\s+(quick|weak|drill))?(?:\s+(.*))?$/i);
  const subject = (m?.[1] || m?.[2] || m?.[3] || "Mathematics").trim();
  const mode = ((m?.[4] || "quick").toLowerCase() as Mode);
  const topic = m?.[5]?.trim() || undefined;
  return { subject, mode, topic };
}

/* ---- command wiring ---- */
export function registerDev(bot: Telegraf<Context>) {
  const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID || process.env.TG_ADMIN_ID || ""; // your own Telegram ID

  bot.command("dev", async (ctx) => {
    if (ADMIN_ID && String(ctx.from?.id) !== ADMIN_ID) return; // guard

    const text = (ctx.message?.text || "").trim();
    const [_, sub = "", arg = ""] = text.split(/\s+/);
    const telegramId = ctx.from!.id.toString();
    const db = await connectDB();

    /* reset daily counters (legacy) */
    if (sub === "reset") {
      await db.collection("daily_counters").deleteMany({ telegramId, date: todayKey() });
      return ctx.reply("🧪 Dev: today’s plan counters reset.");
    }

    /* set plan tier quickly */
    if (sub === "tier") {
      const tier = (arg as Tier) || "ultra";
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
      const py = await detectPythonCmd();
      const pyVer = await pythonVersionStr(py.cmd, py.args);
      const worker = resolveWorkerPath();
      const outBase = process.env.PDF_OUT_DIR?.trim() || path.join(tmpdir(), "brainbot_pdfs");

      try {
        const md = [
          "# BrainBot PDF Self-Test",
          "",
          `- Timestamp: ${new Date().toISOString()}`,
          `- Env PDF_OUT_DIR: \`${process.env.PDF_OUT_DIR || "(default)"}\``,
          "",
          "If you can read this in a PDF, the worker is alive ✅",
        ].join("\n");

        const { filePath, filename } = await renderMarkdownToPdf(md, "BrainBot • PDF Self-Test");
        await ctx.replyWithDocument(
          { source: filePath, filename },
          {
            caption:
              [
                "🧪 *PDF self-test complete*",
                "",
                `• Python: \`${[py.cmd, ...py.args].join(" ")}\``,
                `• Source: \`${py.source}\` — ${pyVer || "(version unknown)"}`,
                `• Worker: \`${worker}\``,
                `• Out dir: \`${outBase}\``,
                `• File: \`${filePath}\``,
              ].join("\n"),
            parse_mode: "Markdown",
          }
        );
      } catch (e: any) {
        return ctx.reply(
          [
            "❌ *PDF self-test failed*",
            "",
            `• Python tried: \`${[py.cmd, ...py.args].join(" ")}\` (${py.source})`,
            `• Worker path: \`${worker}\``,
            "",
            "Tip: set `PYTHON_BIN` in `.env` (e.g., `py -3` on Windows, or `python3` on Linux/macos).",
            `Error: ${e?.message || e}`,
          ].join("\n"),
          { parse_mode: "Markdown" }
        );
      }
      return;
    }

    /* ------- Session generator smoke test ------- */
    if (sub === "session") {
      const { subject, mode, topic } = parseSessionArgs(text);
      try {
        const { content } = await generateSession({ subject, mode, topic });

        // Send Markdown content
        await ctx.reply(
          `🧪 *Dev Session*\nSubject: *${subject}*\nMode: *${mode}*` + (topic ? `\nTopic: _${topic}_` : ""),
          { parse_mode: "Markdown" }
        );
        await ctx.reply(content, { parse_mode: "Markdown" });

        // Also attach a PDF for easy eyeballing
        try {
          const { filePath, filename } = await renderMarkdownToPdf(content, `${subject} — Dev Session`);
          await ctx.replyWithDocument(
            { source: filePath, filename },
            { caption: "⬇️ PDF attached for review" }
          );
        } catch (e: any) {
          await ctx.reply(`(PDF render skipped: ${e?.message || e})`);
        }
      } catch (e: any) {
        return ctx.reply(`❌ Session generation failed: ${e?.message || e}`);
      }
      return;
    }

    /* help */
    if (sub === "help" || !sub) {
      return ctx.reply(
        [
          "Dev cmds:",
          "• `/dev reset` – clear today’s minutes/subjects",
          "• `/dev tier <lite|pro|plus|ultra>` – set plan tier",
          "• `/dev pdf-selftest` – render a 1-page PDF and report Python + paths",
          "• `/dev session <subject> [quick|weak|drill] [topic…]`",
          "   e.g., `/dev session Mathematics drill`",
          "         `/dev session \"History & Government\" weak Causes of WWI`",
        ].join("\n"),
        { parse_mode: "Markdown" }
      );
    }
  });
}
