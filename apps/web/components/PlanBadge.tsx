export default function PlanBadge({ tier }: { tier: string }) {
  const color =
    tier === "Elite"
      ? "bg-yellow-400 text-yellow-900"
      : tier === "Limited-Edition"
      ? "bg-blue-400 text-white"
      : tier === "Serious Prep"
      ? "bg-green-400 text-green-900"
      : tier === "Steady"
      ? "bg-blue-200 text-blue-900"
      : "bg-brand-500 text-white";
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold ${color}`}>
      {tier}
    </span>
  );
}
