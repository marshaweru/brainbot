'use client';

import Link from "next/link";
import { useEffect, useState } from "react";

const TG_BOT = process.env.NEXT_PUBLIC_TG_BOT_USERNAME || "";
const tg = (path = "free") => (TG_BOT ? `https://t.me/${TG_BOT}?start=${path}` : "#");

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const closeMenu = () => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 200); // matches animate-slideUp
  };

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeMenu();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // lock body scroll while menu is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  return (
    <header className="sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-5 py-3">
        <div className="glass rounded-2xl px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-baseline gap-2" onClick={closeMenu} aria-label="BrainBot home">
            <span className="text-2xl">🧠</span>
            <span className="text-white text-lg md:text-xl font-semibold">BrainBot</span>
            <span className="hidden sm:inline text-xs text-slate-400">
              • your ultimate study buddy
            </span>
          </Link>

          {/* desktop nav */}
          <nav className="hidden md:flex items-center gap-5 text-gray-200">
            <Link href="/pricing" className="hover:text-white">Pricing</Link>
            <Link href="/dashboard" className="hover:text-white">My Space</Link>
            <Link href="/login" className="hover:text-white">Login</Link>
            <a
              href={tg("free")}
              aria-disabled={!TG_BOT}
              className={`px-3 py-2 rounded-lg font-semibold transition ${
                TG_BOT
                  ? "bg-gradient-to-r from-emerald-400 to-cyan-300 text-black hover:from-emerald-300 hover:to-cyan-200 animate-pulse-once"
                  : "pointer-events-none bg-slate-600 text-slate-300"
              }`}
            >
              Start Free (2 Sessions)
            </a>
          </nav>

          {/* mobile hamburger */}
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => (open ? closeMenu() : setOpen(true))}
            className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-white/90 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" className={`${open ? "hidden" : "block"}`}>
              <path fill="currentColor" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" />
            </svg>
            <svg width="24" height="24" viewBox="0 0 24 24" className={`${open ? "block" : "hidden"}`}>
              <path fill="currentColor" d="M18.3 5.71L12 12l6.3 6.29-1.41 1.41L12 13.41l-4.89 4.89-1.41-1.41L10.59 12 4.29 5.71 5.7 4.29 12 10.59l6.29-6.3z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* mobile menu overlay */}
      <div className={`md:hidden fixed inset-0 z-30 ${open ? "block" : "hidden"}`} role="dialog" aria-modal="true">
        {/* dim bg */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeMenu} />
        {/* panel */}
        <div className="relative mx-auto max-w-6xl px-5 pt-2">
          <div className={`glass rounded-2xl p-4 mt-2 shadow-2xl ${closing ? "animate-slideUp" : "animate-slideDown"}`}>
            <nav className="flex flex-col gap-3 text-gray-200">
              <Link href="/pricing" className="hover:text-white" onClick={closeMenu}>Pricing</Link>
              <Link href="/dashboard" className="hover:text-white" onClick={closeMenu}>My Space</Link>
              <Link href="/login" className="hover:text-white" onClick={closeMenu}>Login</Link>
              <a
                href={tg("free")}
                onClick={closeMenu}
                aria-disabled={!TG_BOT}
                className={`mt-1 inline-flex items-center justify-center rounded-lg px-3 py-2 font-semibold transition ${
                  TG_BOT
                    ? "bg-gradient-to-r from-emerald-400 to-cyan-300 text-black hover:from-emerald-300 hover:to-cyan-200"
                    : "pointer-events-none bg-slate-600 text-slate-300"
                }`}
              >
                🚀 Start Free (2 Sessions)
              </a>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
