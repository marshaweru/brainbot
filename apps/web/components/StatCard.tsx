export default function StatCard({
  title, value, valueClass = ""
}: { title: string; value: string | number; valueClass?: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.02] backdrop-blur-xs border border-white/10 shadow-[0_8px_28px_rgba(0,0,0,0.35)] p-6 text-center">
      <div className={`text-3xl font-extrabold ${valueClass}`}>{value}</div>
      <div className="text-sm text-steel-300 mt-1">{title}</div>
    </div>
  );
}
