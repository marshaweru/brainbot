// apps/web/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "BrainBot",
  description: "KCSE trainer",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Early theme: localStorage > system (prevents FOUC) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  try {
    var ls = localStorage.getItem('bb-theme');
    var system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var t = (ls === 'dark' || ls === 'light') ? ls : system;
    if (t === 'dark') document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 text-white antialiased flex flex-col">
        {/* Global nav */}
        <header className="sticky top-0 z-40 backdrop-blur bg-ink-900/70 border-b border-white/10">
          <nav className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            <Link href="/" className="text-xl font-extrabold text-gold-500 tracking-tight">
              BrainBot
            </Link>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/dashboard" className="hover:text-mint-400 transition">Dashboard</Link>
              <Link href="/session?plan=free" className="hover:text-mint-400 transition">Start Session</Link>
              <Link href="/start-paper" className="hover:text-mint-400 transition">Full Paper</Link>
              <Link href="/pricing" className="hover:text-mint-400 transition">Pricing</Link>
              <Link href="/privacy" className="hover:text-mint-400 transition">Privacy</Link>
              <ThemeToggle />
            </div>
          </nav>
        </header>

        {/* Main content */}
        <main className="flex-1">{children}</main>

        {/* Global footer */}
        <footer className="border-t border-white/10 bg-ink-900/70 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-xs text-steel-400 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>© {new Date().getFullYear()} BrainBot Africa. All rights reserved.</div>
            <div className="flex gap-4">
              <Link href="/terms" className="hover:text-mint-400 transition">Terms</Link>
              <Link href="/privacy" className="hover:text-mint-400 transition">Privacy</Link>
              <a href="mailto:chariee@proton.me" className="hover:text-mint-400 transition">Contact</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
