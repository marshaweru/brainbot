// apps/web/components/Header.tsx
import Link from "next/link";
import { getSession } from "@/lib/session";

const TG_BOT = process.env.NEXT_PUBLIC_TG_BOT_USERNAME || "<your_bot_username>";
const tg = (path = "free") => `https://t.me/${TG_BOT}?start=${path}`;

export default async function Header() {
  const session = await getSession();

  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
      <Link href="/" aria-label="BrainBot home" className="group inline-flex items-baseline gap-2">
        <span className="text-lg font-semibold text-white">BrainBot</span>
        <span className="hidden sm:inline text-xs text-slate-400 group-hover:text-slate-300">
          • your ultimate productivity tool
        </span>
      </Link>

      <nav className="flex items-center gap-4">
        <Link href="/pricing" className="text-slate-300 hover:text-white">
          Pricing
        </Link>

        {session ? (
          <>
            <Link href="/dashboard" className="text-slate-300 hover:text-white">
              My Space
            </Link>
            <a
              href="/api/auth/logout"
              className="rounded-lg bg-slate-700 px-3 py-1.5 hover:bg-slate-600"
            >
              Logout
            </a>
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-white hover:bg-slate-600"
          >
            Login
          </Link>
        )}

        {/* Primary CTA */}
        <a
          href={tg("free")}
          className="ml-1 rounded-lg px-3 py-1.5 font-semibold text-black bg-gradient-to-r from-emerald-400 to-cyan-300 hover:from-emerald-300 hover:to-cyan-200 transition animate-pulse-once"
          aria-label="Start Free — 2 Subjects"
        >
          Start Free — 2 Subjects
        </a>
      </nav>
    </header>
  );
}
