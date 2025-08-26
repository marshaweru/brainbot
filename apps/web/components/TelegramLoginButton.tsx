"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, any>) => void;
  }
}

export default function TelegramLoginButton() {
  const router = useRouter();
  const search = useSearchParams();
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    const bot = process.env.NEXT_PUBLIC_TG_BOT_USERNAME;
    if (!bot) {
      // Fail soft if env missing
      return;
    }

    // Global callback the widget will call
    window.onTelegramAuth = async (user) => {
      try {
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
        });
        const ok = res.ok;
        if (!ok) {
          const { error } = await res.json().catch(() => ({ error: "login failed" }));
          alert(error || "Login failed");
          return;
        }
        const redirect = search.get("redirect") || "/dashboard";
        router.push(redirect);
      } catch {
        alert("Login failed — check connection and try again.");
      }
    };

    // Inject Telegram widget
    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.async = true;
    s.setAttribute("data-telegram-login", bot);
    s.setAttribute("data-size", "large");
    s.setAttribute("data-onauth", "onTelegramAuth");
    s.setAttribute("data-request-access", "write"); // lets us DM from the bot later
    document.getElementById("tg-login-root")?.appendChild(s);

    return () => {
      delete window.onTelegramAuth;
    };
  }, [router, search]);

  return (
    <div className="flex flex-col items-start gap-3">
      <div id="tg-login-root" />
      {/* Fallback link if the widget can’t load (NoScript, CSP, etc.) */}
      <a
        className="rounded-xl bg-emerald-500 px-4 py-2 font-medium text-black"
        href={`https://t.me/${process.env.NEXT_PUBLIC_TG_BOT_USERNAME ?? ""}`}
        target="_blank"
        rel="noreferrer"
      >
        Open Bot in Telegram
      </a>
    </div>
  );
}
