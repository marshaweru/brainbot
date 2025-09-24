// apps/web/components/PricingCards.tsx
import clsx from "clsx";
import { headers } from "next/headers";
import type { CSSProperties } from "react";

type Plan = {
  name: string;
  price: string;
  subtitle: string;
  badge: "MOST" | "LIMITED" | null;
  features: string[];
  cta: string;
  accent: "mint" | "gold" | "plum";
};

type Props = {
  buildCtaHref?: (planName: string) => string; // optional override for CTA links
};

function safeInt(n: unknown, fallback: number) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

export default async function PricingCards({ buildCtaHref }: Props) {
  // Build absolute URL for SSR fetch
  const h = headers();
  const forwardedHost = h.get("x-forwarded-host");
  const host = forwardedHost ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = `${proto}://${host}`;

  // Defaults in case API call fails
  let claimed = 0;
  let total = 100;

  try {
    const res = await fetch(`${base}/api/limited-edition`, { cache: "no-store" });
    if (res.ok) {
      const j = await res.json();
      claimed = safeInt(j.claimed, 0);
      total = safeInt(j.total, 100);
    }
  } catch {
    // swallow — fallback to defaults
  }

  const plans: Plan[] = [
    {
      name: "Lite Pass",
      price: "KES 69",
      subtitle: "1 day • 3 hours • 1 full paper",
      badge: null,
      features: [
        "Attempt 1 full KCSE paper",
        "3 hours/session",
        "Text, photo & voice upload",
        "Examiner marking & feedback",
        "PDF export (trial mode)",
      ],
      cta: "Get Lite",
      accent: "mint",
    },
    {
      name: "Steady Pass",
      price: "KES 499",
      subtitle: "7 days • 3 hours/day • 1 paper/day",
      badge: null,
      features: [
        "1 full KCSE paper per day",
        "3 hours per session",
        "Text, photo & voice upload",
        "Examiner marking & feedback",
        "PDF export",
      ],
      cta: "Get Steady",
      accent: "mint",
    },
    {
      name: "Elite Prep",
      price: "KES 5,999",
      subtitle: "30 days • 4 papers/day • unlimited hours",
      badge: "MOST",
      features: [
        "4 full KCSE papers per day",
        "Unlimited hours & topic drills",
        "All features of Serious Prep",
        "Examiner tips & analytics",
        "Priority PDF & voice feedback",
        "Progress dashboard",
        "Instant plan upgrade",
        "Elite badge everywhere",
      ],
      cta: "Go Elite",
      accent: "gold",
    },
    {
      name: "Serious Prep",
      price: "KES 2,999",
      subtitle: "30 days • 2 papers/day • 6 hours/day",
      badge: null,
      features: [
        "2 full KCSE papers per day",
        "6 hours/day study time",
        "Unlimited topic drills",
        "Text, photo & voice upload",
        "Examiner marking & feedback",
        "PDF export",
        "Dashboard analytics",
      ],
      cta: "Get Serious",
      accent: "mint",
    },
    {
      name: "Limited-Edition Prep Pass",
      price: "KES 1,499",
      subtitle: `First 100 only • ${claimed}/${total} claimed • 30 days • 2 papers/day`,
      badge: "LIMITED",
      features: [
        "All Serious Prep features",
        "2 full KCSE papers per day",
        "6 hours/day study time",
        "PDF export",
        "Priority support",
        "Price locked for life",
        "Exclusive badge",
      ],
      cta: "Get Limited-Edition Pass",
      accent: "plum",
    },
  ];

  const claimPct = Math.min(
    100,
    Math.max(0, total ? Math.round((claimed / total) * 100) : 0)
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 w-full">
      {plans.map((plan) => {
        const isElite = plan.badge === "MOST";
        const isLimited = plan.badge === "LIMITED";

        // 🔗 CTA link: either deep-link (if provided) or fallback
        const href = buildCtaHref ? buildCtaHref(plan.name) : "#pay";

        return (
          <div
            key={plan.name}
            className={clsx(
              "flex flex-col glass-light rounded-2xl p-5 shadow-lg text-white min-h-full",
              isElite && "ring-2 ring-gold-500 shadow-gold-500/40 shadow-xl",
              isLimited && "ring-2 ring-plum-400"
            )}
            style={
              isLimited
                ? ({ animation: "pulse 1.5s ease-out 1" } as CSSProperties)
                : undefined
            }
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div
                className={clsx(
                  "text-lg font-bold",
                  isElite ? "text-gold-500" : "text-white"
                )}
              >
                {plan.name}
              </div>

              {plan.badge && (
                <div
                  className={clsx(
                    "px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wide",
                    isElite && "bg-gold-500 text-black",
                    isLimited && "bg-plum-400 text-black"
                  )}
                  aria-label={isElite ? "Most popular" : "Limited edition"}
                >
                  {isElite ? "ELITE • MOST POPULAR" : plan.badge}
                </div>
              )}
            </div>

            {/* Price */}
            <div
              className={clsx(
                "text-2xl font-extrabold mb-1",
                isElite ? "text-gold-500" : "text-white"
              )}
            >
              {plan.price}
            </div>
            <div className="text-xs opacity-80 mb-3">{plan.subtitle}</div>

            {/* Features */}
            <ul className="mb-4 space-y-1 text-sm">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="text-green-400" aria-hidden>
                    ✔
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {/* Limited edition progress */}
            {isLimited && (
              <div className="mb-3">
                <div className="h-2 w-full rounded-full bg-white/20 overflow-hidden">
                  <div
                    className="h-2 bg-plum-400"
                    style={{ width: `${claimPct}%` }}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={claimPct}
                    role="progressbar"
                  />
                </div>
                <div className="mt-1 text-[10px] opacity-80">{claimPct}% claimed</div>
              </div>
            )}

            {/* CTA */}
            <a
              href={href}
              className={clsx(
                "rounded-xl px-4 py-2 mt-auto font-bold text-center transition",
                plan.accent === "gold"
                  ? "bg-gold-500 text-black hover:bg-gold-400 shadow-lg shadow-gold-500/40"
                  : plan.accent === "plum"
                  ? "bg-plum-400 text-black hover:bg-plum-500"
                  : "bg-mint-500 text-black hover:bg-mint-400"
              )}
              rel="noopener noreferrer"
              target="_blank"
            >
              {plan.cta}
            </a>
          </div>
        );
      })}
    </div>
  );
}
