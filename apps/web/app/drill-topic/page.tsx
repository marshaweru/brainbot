"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

const TG_BOT = "brainbotafrica_bot"; // your bot username

// Optional: accept ?plan= to tag context, default to free
const PLAN_KEYS: Record<string, string> = {
  free: "free",
  lite: "lite",
  steady: "steady",
  serious: "serious",
  elite: "elite",
  limited: "limited",
};

export default function DrillTopicHandoff() {
  const sp = useSearchParams();
  const plan = (sp.get("plan") || "free").toLowerCase();
  const planKey = PLAN_KEYS[plan] ?? PLAN_KEYS.free;

  // Deep-link to drill mode; your bot should parse "drill_<plan>"
  const startKey = `drill_${planKey}`;
  const deepLink = useMemo(
    () => `https://t.me/${TG_BOT}?start=${encodeURIComponent(startKey)}`,
    [startKey]
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 text-white">
      <section className="min-h-screen flex items-center px-4 py-10">
        <div className="glass mx-auto w-[96vw] max-w-4xl rounded-2xl p-10 md:p-14 shadow-glass text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold mb-3">
            Drill by Topic in <span className="text-gold-500">Telegram</span>
          </h1>

          <p className="text-steel-200 max-w-2xl mx-auto mb-8">
            We’ll open BrainBot in Telegram and start a topic drill flow. Your current
            plan will be tagged as <b>{plan.toUpperCase()}</b> for limits and access.
          </p>

          <a
            href={deepLink}
            target="_blank"
            rel="noreferrer"
            className="inline-block rounded-2xl px-8 py-4 text-lg font-bold
                       bg-gold-500 text-ink-900 hover:bg-gold-400 active:scale-95 transition"
          >
            Open Drill in Telegram
          </a>

          <div className="mt-6 text-sm text-steel-300 space-y-2">
            <p>If prompted, choose <b>Telegram</b> to open the link.</p>
            <p>
              If nothing opens: search <span className="font-mono">@{TG_BOT}</span> and send{" "}
              <span className="font-mono">/start {startKey}</span>.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
