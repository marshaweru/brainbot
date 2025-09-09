"use client";
import Link from "next/link";
import { useState } from "react";
import KCSEBadge from "../../components/KCSEBadge";
import ExpiryCountdown from "../../components/ExpiryCountdown";

// Placeholder data (replace with backend/api logic later)
const userStats = {
  papersDone: 1,
  bestScore: 78,
  weakTopics: ["Algebra", "Probability", "Geography"],
  plan: "Free 3-Hour Trial",
  expires: "in 2h 10m",
};

export default function DashboardPage() {
  const [showUpgrade, setShowUpgrade] = useState(true);

  return (
    <div className="min-h-screen bg-ink-900 py-10 px-2">
      <div className="glass max-w-4xl mx-auto p-8 flex flex-col gap-4 shadow-glass">
        {/* Countdown badge */}
        <div className="mb-4">
          <KCSEBadge />
        </div>

        <h2 className="text-3xl font-extrabold mb-1 text-gold-400">
          👋 Welcome to Your BrainBot Dashboard
        </h2>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="font-bold text-gray-300 mr-2">Plan:</span>
            <span className="text-gold-400 font-bold">{userStats.plan}</span>
          </div>
          {/* If you’re using ExpiryCountdown, swap this span for the live component */}
          <div className="text-sm text-gray-400">
            <span>Expires: {userStats.expires}</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Papers Attempted */}
          <div className="group rounded-xl glass-light p-5 text-center border border-gold-500/30 shadow-lg transition transform hover:scale-[1.02] hover:border-gold-400/60">
            <div className="text-3xl font-extrabold text-gold-400">
              {userStats.papersDone}
            </div>
            <div className="text-sm text-steel-300">Papers Attempted</div>
          </div>

          {/* Best Score */}
          <div className="group rounded-xl glass-light p-5 text-center border border-emerald-400/30 shadow-lg transition transform hover:scale-[1.02] hover:border-emerald-300/60">
            <div className="text-3xl font-extrabold text-emerald-400">
              {userStats.bestScore}/100
            </div>
            <div className="text-sm text-steel-300">Best Score</div>
          </div>

          {/* Weak Topics */}
          <div className="group rounded-xl glass-light p-5 text-center border border-rose-400/30 shadow-lg transition transform hover:scale-[1.02] hover:border-rose-300/60">
            <div className="text-3xl font-extrabold text-rose-400 leading-tight">
              {userStats.weakTopics.join(", ")}
            </div>
            <div className="text-sm text-steel-300">Weak Topics</div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col md:flex-row gap-4">
          {/* Primary → Telegram handoff via /session */}
          <Link
            href="/session?plan=free"
            className="flex-1 rounded-2xl px-6 py-4 text-base font-bold bg-gold-500 text-ink-900 hover:bg-gold-400 active:scale-95 transition shadow"
          >
            Start Full KCSE Paper
          </Link>

          {/* Drill → Telegram handoff page */}
          <Link
            href="/drill-topic?plan=free"
            className="flex-1 rounded-2xl px-6 py-4 text-base font-bold bg-gold-500 text-ink-900 hover:bg-gold-400 active:scale-95 transition shadow"
          >
            Drill by Topic
          </Link>
        </div>

        {/* Upgrade notice */}
        {showUpgrade && (
          <div className="rounded-xl px-6 py-6 mt-7 flex flex-col items-center text-center bg-gold-500 text-ink-900 shadow-lg">
            <div className="font-bold text-lg mb-2">
              🚨 Upgrade for More Features & Unlimited Papers!
            </div>
            <div className="text-sm mb-3">
              Unlock audio uploads, PDF export, extra hours, and access to all tiers.
            </div>
            <Link href="/#pricing" className="underline font-bold">
              See Plans & Pay Now
            </Link>
            <button
              onClick={() => setShowUpgrade(false)}
              className="mt-2 text-xs text-gray-800 hover:underline"
            >
              Hide
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
