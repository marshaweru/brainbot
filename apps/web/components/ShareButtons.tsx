"use client";
import { useMemo } from "react";

type Props = {
  url?: string;           // if omitted, uses window.location.href
  text?: string;          // prefilled message
  utm?: string;           // e.g. "utm_source=web_landing&utm_campaign=brainbot_v4"
  className?: string;
};

export default function ShareButtons({ url, text, utm = "utm_source=web_landing&utm_campaign=brainbot_v4", className }: Props) {
  const href = useMemo(() => {
    const base = url || (typeof window !== "undefined" ? window.location.href : "");
    if (!base) return "";
    return base.includes("?") ? base + "&" + utm : base + "?" + utm;
  }, [url, utm]);

  const msg = encodeURIComponent(text || "BrainBot — KCSE Club 84 revision assistant");
  const encUrl = encodeURIComponent(href);

  const wa = `https://wa.me/?text=${msg}%20${encUrl}`;
  const tg = `https://t.me/share/url?url=${encUrl}&text=${msg}`;

  return (
    <div className={["flex gap-2", className || ""].join(" ")}>
      <a href={wa} target="_blank" rel="noreferrer" className="rounded-full border px-4 py-2 text-sm hover:opacity-90">Share on WhatsApp</a>
      <a href={tg} target="_blank" rel="noreferrer" className="rounded-full border px-4 py-2 text-sm hover:opacity-90">Share on Telegram</a>
    </div>
  );
}
