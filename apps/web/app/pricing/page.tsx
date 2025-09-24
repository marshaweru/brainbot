// apps/web/app/pricing/page.tsx
import PricingCards from "@/components/PricingCards";
import ShareButtons from "@/components/ShareButtons";

const TG_BOT = "brainbotafrica_bot";

const PLAN_KEYS: Record<string, string> = {
  "Lite Pass": "lite",
  "Steady Pass": "steady",
  "Serious Prep": "serious",
  "Elite Prep": "elite",
  "Limited-Edition Prep Pass": "limited",
};

// https://t.me/brainbotafrica_bot?start=pay_<plan>
function deepLinkFor(planName: string) {
  const key = PLAN_KEYS[planName] ?? "lite";
  return `https://t.me/${TG_BOT}?start=${encodeURIComponent(`pay_${key}`)}`;
}

export default function PricingPage() {
  return (
    <div className="min-h-svh flex flex-col bg-[var(--app-bg,black)]">
      {/* Sticky nav */}
      <header className="sticky top-0 z-20 backdrop-blur bg-black/40 border-b border-white/10">
        <nav className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <a href="/" className="font-extrabold text-white">BrainBot</a>
          <div className="flex items-center gap-4 text-sm text-white/80">
            <a href="/dashboard" className="hover:text-white">Dashboard</a>
            <a href="/session" className="hover:text-white">Session</a>
            <a href="/start-paper" className="hover:text-white">Start Paper</a>
            <a href="/pricing" className="text-white font-semibold">Pricing</a>
          </div>
        </nav>
      </header>

      {/* Main */}
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-8">
          <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-2">
            Choose your KCSE plan
          </h1>
          <p className="text-white/70 mb-6">
            Pick a tier, tap once, pay in Telegram, and start immediately. No extra hoops.
          </p>

          {/* Pricing grid → still SSR, deep-linked CTAs */}
          {/* PricingCards already supports buildCtaHref */}
          {/* @ts-ignore - fine in Next RSC */}
          <PricingCards buildCtaHref={deepLinkFor} />

          {/* Share row */}
          <div className="mt-8 flex items-center justify-between">
            <p className="text-sm text-white/70">Put a friend onto Club 84:</p>
            <ShareButtons
              className="justify-end"
              text="I’m using BrainBot for KCSE prep — try it:"
              // url omitted → auto-uses current /pricing URL with UTM
              utm="utm_source=share&utm_medium=buttons&utm_campaign=pricing_v1"
            />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-8 border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-white/70 flex items-center justify-between">
          <span>© {new Date().getFullYear()} BrainBot Africa — KCSE Focused Exam Trainer</span>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-white">Privacy</a>
            <a href="/terms" className="hover:text-white">Terms</a>
            <a href="mailto:hello@brainbot.africa" className="hover:text-white">hello@brainbot.africa</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
