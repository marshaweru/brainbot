// apps/web/components/StatCard.tsx
type Props = {
  title: string;
  value: string | number;
  valueClass?: string;
  subtitle?: string;
};

export default function StatCard({ title, value, valueClass = "", subtitle }: Props) {
  return (
    <div
      className="rounded-2xl bg-white/[0.02] backdrop-blur-xs border border-white/10 shadow-[0_8px_28px_rgba(0,0,0,0.35)] p-6 text-center"
      role="status"
      aria-label={typeof value === "number" ? `${value} ${title}` : `${value} ${title}`}
    >
      <div className={`text-3xl font-extrabold ${valueClass}`}>{value}</div>
      <div className="text-sm text-white/60 mt-1">{title}</div>
      {subtitle && <div className="text-xs text-white/40 mt-0.5">{subtitle}</div>}
    </div>
  );
}
