import React from "react";
import Link from "next/link";
import PricingCards from "../components/PricingCards";
import KCSEBadge from "../components/KCSEBadge";
// import KCSECountdown from "../components/KCSECountdown"; // not used
import ShareButtons from "../components/ShareButtons";

export default function HomePage() {
  return (
    <main className="bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 text-white">
      {/* Hero Section */}
      <section className="min-h-screen px-4 pt-12 pb-10 flex items-center">
        <div className="glass mx-auto w-[95vw] max-w-6xl rounded-2xl shadow-glass p-8 md:p-12">
          {/* Countdown pill */}
          <KCSEBadge />

          <h1 className="text-4xl font-extrabold leading-tight">
            <span className="text-gold-500">BrainBot</span> —{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-plum-400 to-mint-400">
              Your KCSE Focused Exam Trainer
            </span>
          </h1>

          <div className="mt-4">
            <p className="text-steel-200 leading-relaxed max-w-3xl">
              KCSE isn’t just grades — it’s the gateway to university, scholarships,
              life-changing opportunities, and career freedom. Only 3 more KCSE sittings in
              2025, 2026 and 2027 before the system changes — the pressure is real, <strong>but so is
              your opportunity</strong>. Train smart now, <strong>before it’s too late.</strong>
            </p>
          </div>

          <div className="mt-4">
            <p className="text-steel-200 mt-2">
              <b>KCSE Mode:</b> Start with a real exam, get examiner feedback, and
              upgrade for more.
            </p>
            <p className="text-steel-200">
              🚀 <b>3-hour free session</b> (all features). No registration required.
            </p>
            <p className="text-steel-200">
              <b>10 core subjects.</b> Only KCSE. No fluff. All glass.
            </p>
          </div>

          {/* CTA buttons (clean, no glow) */}
          <div className="flex gap-4 w-full mt-6 mb-6">
            {/* 🔗 Point straight to the Telegram handoff */}
            <Link
              href="/session?plan=free"
              className="flex-1 rounded-2xl text-lg px-6 py-3 font-bold
                         bg-gold-500 text-ink-900 hover:bg-gold-400 active:scale-95
                         transition transform"
            >
              Start Free 3-Hour Session
            </Link>

            <Link
              href="#pricing"
              className="flex-1 rounded-2xl text-lg px-6 py-3 font-bold
                         border border-plum-400 text-plum-400
                         bg-white/5 hover:bg-white/10 active:scale-95 transition"
            >
              See Pricing
            </Link>
          </div>

          {/* Share buttons row — spaced below CTA */}
          <div className="mt-4">
            <ShareButtons />
          </div>

          {/* Bot link */}
          <div className="mt-6 text-sm text-steel-200">
            Try it on Telegram 👉{" "}
            <a
              href="https://t.me/brainbotafrica_bot"
              target="_blank"
              rel="noreferrer"
              className="underline text-plum-400 hover:text-plum-500"
            >
              @brainbotafrica_bot
            </a>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="px-4 pt-6 pb-16 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">
          Choose Your Prep Pass
        </h2>
        <PricingCards />

        {/* Footer Paybill badge */}
        <div className="mt-12 flex flex-col items-center gap-6 text-sm text-gray-300">
          <div className="glass rounded-xl px-6 py-4 text-center shadow-md">
            <div className="text-xs uppercase tracking-wider text-blue-400 font-bold mb-1">
              Official Payment
            </div>
            <div className="text-lg font-extrabold text-blue-300">
              Paybill:{" "}
              <span className="font-mono text-2xl text-yellow-300">4168557</span>
            </div>
            <div className="text-sm">
              Account Name: <span className="font-semibold">Rizzline Africa</span>
            </div>
            <div className="text-xs mt-1 opacity-80">
              Bill/Ref No: <b>Your Telegram ID</b>
            </div>
          </div>

          <div className="flex gap-6">
            <a
              href="mailto:chariee@proton.me"
              className="underline hover:text-blue-400"
            >
              Contact
            </a>
            <a href="/privacy" className="underline hover:text-blue-400">
              Privacy
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
