// apps/web/components/ThemeToggle.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";

function getInitialTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "dark";
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  // fallback to system if unset
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme());
  const btnRef = useRef<HTMLButtonElement>(null);

  // apply theme to <html> + persist
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    root.setAttribute("data-theme", theme);
    try { localStorage.setItem("bb-theme", theme); } catch {}
  }, [theme]);

  // animate on theme change (cute micro interaction)
  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    el.classList.remove("twist");
    // reflow to restart animation
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    el.offsetWidth;
    el.classList.add("twist");
    const t = setTimeout(() => el.classList.remove("twist"), 250);
    return () => clearTimeout(t);
  }, [theme]);

  // cross-tab sync via storage event
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "bb-theme" && (e.newValue === "light" || e.newValue === "dark")) {
        setTheme(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const next = useMemo(() => (theme === "dark" ? "light" : "dark"), [theme]);
  const icon = theme === "dark" ? "🌙" : "☀️";

  return (
    <button
      ref={btnRef}
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={`themetoggle rounded-xl px-3 py-1.5 text-xs border border-white/15 bg-white/5 hover:bg-white/10 ${className}`}
    >
      <span className="icon">{icon}</span>{" "}
      <span className="label hidden sm:inline">{theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
}
