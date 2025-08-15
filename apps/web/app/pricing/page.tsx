'use client';
const TG_BOT = process.env.NEXT_PUBLIC_TG_BOT_USERNAME || "<your_bot_username>";
const tgLink = (path = "upgrade") => `https://t.me/${TG_BOT}?start=${path}`;
export default function Pricing() {
  const tiers = [
    { name: "Lite (Day)", price: "KES 50", sub: "2h/day • 2 subjects/day • 1 day" },
    { name: "Pro (Week)", price: "KES 300", sub: "2h/day • 2 subjects/day • 7 days" },
    { name: "Plus (Month)", price: "KES 1,750", sub: "5h/day • 3 subjects/day • 30 days" },
    { name: "Ultra Plus (Month)", price: "KES 2,500", sub: "8h/day • 4 subjects/day • 30 days" },
    { name: "Founder Deal", price: "KES 1,500", sub: "5h/day • 2 subjects/day • 60 days (first 100)" },
  ];
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-bold text-white">Upgrade your plan</h1>
      <div className="grid md:grid-cols-3 gap-4">
        {tiers.map((t) => (
          <div key={t.name} className="card">
            <h3>{t.name}</h3>
            <div className="text-2xl font-extrabold text-white mt-1">{t.price}</div>
            <div className="text-gray-300 mt-1">{t.sub}</div>
            <a href={tgLink()} className="btn bg-white/10 mt-3">Get {t.name.split(" ")[0]}</a>
          </div>
        ))}
      </div>
      <p className="text-gray-400 text-sm">Payments via M-PESA inside Telegram for now.</p>
    </div>
  );
}
