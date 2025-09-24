// apps/web/app/admin/page.tsx
import AdminStatsGrid from "@/components/AdminStatsGrid";

export default function AdminPage() {
  return (
    <div className="min-h-svh flex flex-col bg-[var(--app-bg,black)] text-white">
      {/* Sticky nav */}
      <header className="sticky top-0 z-20 backdrop-blur bg-black/40 border-b border-white/10">
        <nav className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <a href="/" className="font-extrabold">BrainBot</a>
          <div className="flex items-center gap-4 text-sm text-white/80">
            <a href="/dashboard" className="hover:text-white">Student</a>
            <a href="/pricing" className="hover:text-white">Pricing</a>
            <a href="/admin" className="text-white font-semibold">Admin</a>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-8">
          <h1 className="text-2xl md:text-3xl font-extrabold mb-4">Admin Overview</h1>
          {/* Key metrics */}
          {/* @ts-ignore Async server component */}
          <AdminStatsGrid />

          {/* Space for more owner widgets later (funnels, cohort, MRR, churn) */}
          <div className="mt-8 text-white/60 text-sm">
            Next: add charts for conversion, paper throughput, and plan mix.
          </div>
        </section>
      </main>

      <footer className="mt-8 border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-white/70 flex items-center justify-between">
          <span>© {new Date().getFullYear()} BrainBot Africa — KCSE Focused Exam Trainer</span>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-white">Privacy</a>
            <a href="/terms" className="hover:text-white">Terms</a>
            <a href="mailto:hello@brainbot.africa" className="hover:text-white">hello@brainbot.africa</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
