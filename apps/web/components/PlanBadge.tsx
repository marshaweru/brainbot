// apps/web/components/PlanBadge.tsx
type PlanBadgeProps = {
  tier: string;
  className?: string;
};

export default function PlanBadge({ tier, className = "" }: PlanBadgeProps) {
  const normalized = tier.trim().toLowerCase();

  const color =
    normalized === "elite"
      ? "bg-yellow-400 text-yellow-900"
      : normalized === "limited-edition"
      ? "bg-blue-500 text-white"
      : normalized === "serious prep"
      ? "bg-green-400 text-green-900"
      : normalized === "steady"
      ? "bg-blue-200 text-blue-900"
      : "bg-brand-500 text-white";

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-bold ${color} ${className}`}
    >
      {tier}
    </span>
  );
}
