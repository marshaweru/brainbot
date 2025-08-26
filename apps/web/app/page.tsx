'use client';

import Link from "next/link";
import CountdownBadge from "../components/CountdownBadge";

const TG_BOT = process.env.NEXT_PUBLIC_TG_BOT_USERNAME || "<your_bot_username>";
const tg = (path = "free") => `https://t.me/${TG_BOT}?start=${path}`;

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <p className="mt-2">{desc}</p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12 grid gap-10">
      {/* HERO */}
      <section className="grid md:grid-cols-2 gap-8 items-center">
        <div className="glass rounded-2xl p-8">
          <CountdownBadge target="2025-11-03T08:00:00+03:00" label="KCSE 2025" />

          <h1 className="h1 text-5xl md:text-6xl font-extrabold leading-tight">
            <span className="text-white">The Last 3 KCSEs.</span>{" "}
            <span className="text-gradient">Your Move.</span>
          </h1>

          <p className="mt-4 text-gray-300">
            KCSE isn’t just grades — it’s the gateway to university, scholarships, life-changing opportunities,
            and career freedom. Only 3 more KCSE sittings in 2025, 2026 and 2027 before the system changes —
            the pressure is real, <span className="text-white/90 font-medium">but so is your opportunity</span>.
            Train smart now, <span className="text-white/90 font-medium">before it’s too late.</span>
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href={tg("free")}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-300 text-black font-semibold hover:from-emerald-300 hover:to-cyan-200 transition animate-pulse-once"
            >
              🚀 Start Free 5-Hour Session
            </a>
            <Link
              href="/pricing"
              className="px-5 py-3 rounded-xl bg-white/10 text-white/90 hover:bg-white/15 transition border border-white/10"
            >
              See Pricing
            </Link>
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-300">
            <a
              href={`https://wa.me/?text=${encodeURIComponent('BrainBot — KCSE study assistant: https://yourdomain.xyz')}`}
              target="_blank" rel="noreferrer"
            >Share on WhatsApp</a>
            <span>•</span>
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent('https://yourdomain.xyz')}&text=${encodeURIComponent('BrainBot — KCSE study assistant')}`}
              target="_blank" rel="noreferrer"
            >Share on Telegram</a>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Free starter: 5h total • 2 subjects/day. Upgrade any time in Telegram.
          </p>
        </div>

        {/* features */}
        <div className="grid gap-4">
          <Feature title="Smart-8 plans" desc="Daily plan tuned to your level, subjects, and target grade." />
          <Feature title="KCSE-only content" desc="No fluff. KNEC phrasing, zero topic gaps." />
          <Feature title="Red-pen feedback" desc="Upload and get examiner-style marking with tips to score higher." />
        </div>
      </section>

      {/* MINI PRICING SNAPSHOT */}
      <section className="grid md:grid-cols-5 gap-4">
        {[
          { name: "Lite Pass",    price: "KES 69",    sub: "2h/day • 2 subjects/day • 1 day",       tagline: "2 hrs of exam-focused revision. No fluff, just KCSE drills.", who: "For quick daily boosts.", start: "upgrade" },
          { name: "Steady Pass",  price: "KES 499",   sub: "2h/day • 2 subjects/day • 7 days",      tagline: "A full week of structured plans + quizzes to stay sharp.",   who: "For consistent weekly structure.", start: "upgrade" },
          { name: "Serious Prep", price: "KES 2,999", sub: "5h/day • 3 subjects/day • 30 days",     tagline: "Daily study packs + examiner-style marking.",               who: "For students pushing beyond average.", start: "upgrade" },
          { name: "Club 84",      price: "KES 5,999", sub: "8h/day • 4 subjects/day • 30 days",     tagline: "Elite-level prep. KCSE-only, zero gaps.",                   who: "For determined candidates chasing excellence.", start: "upgrade", highlight: true },
          { name: "Founder’s Offer", price: "KES 1,499", sub: "1 month of Serious Prep (~50% OFF)", tagline: "Limited launch pricing for early believers.", who: "🎯 First 100 only.", start: "founder", limited: true },
        ].map(({ name, price, sub, tagline, who, start, highlight, limited }) => (
          <div
            key={name}
            className={`rounded-2xl p-6 border border-white/10 bg-white/5 shadow-lg hover:scale-105 transition ${highlight ? "ring-2 ring-yellow-400" : ""} ${limited ? "animate-pulse-glow" : ""}`}
          >
            <h3 className="text-white font-heading font-semibold flex items-center justify-between">
              {name}
              {limited && <span className="ml-2 text-xs px-2 py-1 bg-red-500/20 text-red-300 rounded-full">First 100</span>}
            </h3>
            <p className="text-2xl font-extrabold text-gradient mt-1">{price}</p>
            <p className="text-gray-300 mt-1">{sub}</p>
            <p className="text-sm text-gray-300 mt-2">{tagline}</p>
            <p className="text-xs italic text-gray-400 mt-1">{who}</p>
            <a
              href={tg(start)}
              className="block text-center mt-3 rounded-xl bg-yellow-400 text-black font-semibold py-2 hover:bg-yellow-300 transition"
            >
              Get {name.split(" ")[0]}
            </a>
          </div>
        ))}
      </section>
    </div>
  );
}
