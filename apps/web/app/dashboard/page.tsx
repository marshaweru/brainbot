// apps/web/app/dashboard/page.tsx
import { withSession } from "../../lib/session";

export const dynamic = "force-dynamic"; // read fresh cookies/session each hit

export default async function DashboardPage() {
  return withSession(async (session) => {
    const bot = process.env.NEXT_PUBLIC_TG_BOT_USERNAME || "";
    const startLink = bot ? `https://t.me/${bot}?start=free` : "#";

    return (
      <main className="container mx-auto px-4 py-10">
        <header>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            My Space
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Signed in as{" "}
            <span className="font-mono">
              {session.username ?? session.sub}
            </span>
          </p>
        </header>

        <section className="grid gap-6 mt-8 md:grid-cols-3">
          <div className="rounded-2xl bg-[#0E1424] border border-white/10 p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-white">This Week</h2>
            <p className="mt-2 text-gray-300">
              Your Smart-8 plan will appear here once you study in Telegram.
            </p>
            <a
              href={startLink}
              className="inline-flex items-center mt-4 rounded-xl bg-emerald-400/90 hover:bg-emerald-300 text-black font-semibold px-4 py-2"
            >
              Start a Session
            </a>
          </div>

          <div className="rounded-2xl bg-[#0E1424] border border-white/10 p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-white">PDF Library</h2>
            <p className="mt-2 text-gray-300">
              Notes & marking sheets you download will show up here.
            </p>
            <p className="mt-4 text-xs text-gray-500">Coming soon.</p>
          </div>

          <div className="rounded-2xl bg-[#0E1424] border border-white/10 p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-white">
              Weak-Topic Heatmap
            </h2>
            <p className="mt-2 text-gray-300">
              We’ll light up topics that need love after a few sessions.
            </p>
            <p className="mt-4 text-xs text-gray-500">Coming soon.</p>
          </div>
        </section>
      </main>
    );
  }, "/dashboard");
}
