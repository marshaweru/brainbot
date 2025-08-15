'use client';
import Link from "next/link";
const TG_BOT = process.env.NEXT_PUBLIC_TG_BOT_USERNAME || "<your_bot_username>";
const tgLink = `https://t.me/${TG_BOT}?start=free`;
function Feature({ title, desc }: { title: string; desc: string }) {
  return (<div className="card"><h3>{title}</h3><p className="mt-2">{desc}</p></div>);
}
export default function Home() {
  return (
    <div className="grid gap-8">
      <section className="grid md:grid-cols-2 gap-8 items-center">
        <div className="glass rounded-2xl p-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
            KCSE study packs, quizzes & examiner-grade marking.
          </h1>
          <p className="mt-4 text-gray-300">KCSE-only notes, quizzes & assignments. Then “Mark My Work” for red-pen feedback.</p>
          <div className="mt-6 flex items-center gap-4">
            <a href={tgLink} className="btn bg-white/10">🚀 Start Free 5-Hour Session</a>
            <Link href="/pricing" className="btn text-white/80">See Pricing</Link>
          </div>
          <div className="mt-3 flex gap-3 text-sm text-gray-300">
            <a href={`https://wa.me/?text=${encodeURIComponent('BrainBot — KCSE study assistant: http://localhost:4321')}`} target="_blank">Share on WhatsApp</a>
            <span>•</span>
            <a href={`https://t.me/share/url?url=${encodeURIComponent('http://localhost:4321')}&text=${encodeURIComponent('BrainBot — KCSE study assistant')}`} target="_blank">Share on Telegram</a>
          </div>
          <p className="mt-2 text-xs text-gray-400">Free starter: 5h total • 2 subjects/day. Upgrade any time in Telegram.</p>
        </div>
        <div className="grid gap-4">
          <Feature title="Smart-8 plans" desc="Daily plan tuned to your level, subjects, and target grade." />
          <Feature title="KCSE-only content" desc="No fluff. KNEC phrasing, zero topic gaps." />
          <Feature title="Red-pen feedback" desc="Upload and get examiner-style marking with tips to score higher." />
        </div>
      </section>
      <section className="grid md:grid-cols-5 gap-4">
        {[
          ["Lite (Day)", "KES 50", "2h/day • 2 subjects/day • 1 day"],
          ["Pro (Week)", "KES 300", "2h/day • 2 subjects/day • 7 days"],
          ["Plus (Month)", "KES 1,750", "5h/day • 3 subjects/day • 30 days"],
          ["Ultra Plus (Month)", "KES 2,500", "8h/day • 4 subjects/day • 30 days"],
          ["Founder Deal", "KES 1,500", "5h/day • 2 subjects/day • 60 days (first 100)"],
        ].map(([name, price, sub]) => (
          <div key={name} className="card">
            <h3>{name}</h3>
            <p className="text-2xl font-bold text-white mt-1">{price}</p>
            <p className="mt-1">{sub}</p>
            <a href={tgLink} className="btn bg-white/10 mt-3">Get {String(name).split(" ")[0]}</a>
          </div>
        ))}
      </section>
    </div>
  );
}
