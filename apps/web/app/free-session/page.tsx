import Link from "next/link";
import KCSEBadge from "../../components/KCSEBadge";

export default function FreeSessionPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 text-white">
      <section className="min-h-screen flex items-center px-4 py-10">
        <div className="glass mx-auto w-[96vw] max-w-5xl rounded-2xl p-10 md:p-14 shadow-glass text-center">
          <div className="mb-4">
            <KCSEBadge />
          </div>

          <h2 className="text-3xl md:text-4xl font-extrabold text-gold-500 mb-4">
            🚀 Start Your Free 3-Hour KCSE Session!
          </h2>

          <p className="text-lg md:text-xl text-steel-300 max-w-3xl mx-auto mb-8">
            Choose any of the 10 core KCSE subjects. Attempt a full real exam,
            upload your answers, and get examiner-style feedback.
          </p>

          {/* Direct to Telegram handoff */}
          <div className="flex justify-center">
            <Link
              href="/session?plan=free"
              className="rounded-2xl px-8 py-4 text-lg font-bold
                         bg-gold-500 text-ink-900 hover:bg-gold-400 active:scale-95 transition"
            >
              Start Now
            </Link>
          </div>

          <div className="mt-6 text-sm text-steel-300">
            <b>3 hours</b> from the moment you begin — all features unlocked!
          </div>
          <div className="text-xs text-steel-200 mt-2">
            Already upgraded? Go to your{" "}
            <Link
              href="/dashboard"
              className="underline text-mint-400 hover:text-mint-300"
            >
              Dashboard
            </Link>.
          </div>
        </div>
      </section>
    </main>
  );
}
