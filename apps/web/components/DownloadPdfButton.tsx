"use client";

import { useState } from "react";

type RubricItem = { step: string; mark: string; correct: boolean };

export type PdfPayload = {
  student?: { wid?: string; name?: string };
  session?: { id?: string; finishedAt?: string };
  subject?: string;
  score?: number;
  outOf?: number;
  strong?: string[];
  weak?: string[];
  rubric?: RubricItem[];
  tip?: string;
};

export default function DownloadPdfButton({ payload, className = "" }: { payload: PdfPayload; className?: string }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = (await res.json().catch(() => ({})))?.msg || "Failed to generate PDF";
        throw new Error(msg);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      // Open in a new tab
      window.open(url, "_blank", "noopener,noreferrer");
      // Optional: revoke later (keep a few secs so the tab can load)
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e: any) {
      alert(e?.message || "PDF error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`rounded-xl px-4 py-2 border border-white/15 bg-white/5 hover:bg-white/10 text-white ${loading ? "opacity-60 cursor-not-allowed" : ""} ${className}`}
      aria-label="Download feedback as PDF"
    >
      {loading ? "Building PDF…" : "Download PDF"}
    </button>
  );
}
