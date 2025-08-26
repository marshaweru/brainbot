'use client';

const TG_BOT = process.env.NEXT_PUBLIC_TG_BOT_USERNAME || "<your_bot_username>";
const tg = (path = "upgrade") => `https://t.me/${TG_BOT}?start=${path}`;

export default function Pricing() {
  const tiers = [
    {
      name: "Lite Pass",
      price: "KES 69",
      sub: "2h/day • 2 subjects/day • 1 day",
      blurb1: "2 hrs of exam-focused revision. No fluff, just KCSE drills.",
      blurb2: "For quick daily boosts.",
      start: "upgrade",
    },
    {
      name: "Steady Pass",
      price: "KES 499",
      sub: "2h/day • 2 subjects/day • 7 days",
      blurb1: "Plans + quizzes to stay sharp.",
      blurb2: "For consistent weekly structure.",
      start: "upgrade",
    },
    {
      name: "Serious Prep",
      price: "KES 2,999",
      sub: "5h/day • 3 subjects/day • 30 days",
      blurb1: "Daily study packs + examiner-style marking.",
      blurb2: "For students pushing beyond average.",
      start: "upgrade",
    },
    {
      name: "Club 84",
      price: "KES 5,999",
      sub: "8h/day • 4 subjects/day • 30 days",
      blurb1: "KCSE-only, zero gaps.",
      blurb2: "For determined candidates chasing excellence.",
      highlight: true,
      start: "upgrade",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-5 py-10 md:py-12">
      <h1 className="text-center text-3xl md:text-4xl font-extrabold text-white">Choose a plan</h1>
      <p className="text-center text-gray-300 mt-2">
        KCSE-only notes, Smart-8 plans, mini-quizzes, and examiner-style feedback.
        <span className="hidden sm:inline"> Pay via M-PESA — details are handled inside Telegram.</span>
      </p>

      {/* Founder at top with glow */}
      <div className="relative mt-8">
        <div className="absolute inset-0 rounded-2xl blur-2xl opacity-40 bg-gradient-to-r from-fuchsia-500/30 via-indigo-500/25 to-sky-500/30" />
        <div className="relative glass rounded-2xl p-7 md:p-9 text-center shadow-2xl animate-pulse-glow">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400 text-black text-sm font-semibold">
            First 100
          </div>
          <h2 className="mt-3 text-2xl md:text-3xl font-bold text-white">Founder’s Offer</h2>
          <div className="mt-1 text-4xl md:text-5xl font-extrabold text-yellow-300">KES 1,499</div>
          <p className="mt-2 text-gray-200">1 month of <span className="font-semibold">Serious Prep</span> (~50% OFF)</p>
          <p className="text-xs text-red-300">Closes once 100 slots are taken.</p>
          <a
            href={tg("founder")}
            className="inline-block mt-4 px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-300 text-black font-semibold hover:from-yellow-300 hover:to-yellow-200 transition"
          >
            🔥 Claim Founder
          </a>
        </div>
      </div>

      {/* Tier grid — designed to fit on one fold on laptops; wraps gracefully on phones */}
      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`rounded-2xl p-6 shadow-lg border border-white/10 bg-gradient-to-b from-white/5 to-white/0
              ${t.highlight ? "ring-2 ring-yellow-400" : ""}`}
          >
            <h3 className="text-white text-xl font-bold">{t.name}</h3>
            <div className="text-3xl font-extrabold text-yellow-300 mt-1">{t.price}</div>
            <p className="text-gray-300 mt-1">{t.sub}</p>
            <p className="text-gray-300 mt-2 text-sm">{t.blurb1}</p>
            <p className="text-gray-400 mt-1 text-xs italic">{t.blurb2}</p>
            <a
              href={tg(t.start)}
              className="block text-center mt-4 rounded-xl bg-yellow-400 text-black font-semibold py-2 hover:bg-yellow-300 transition"
            >
              Get {t.name.split(" ")[0]}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
