"use client";

import { useState } from "react";

type PDFExportProps = {
  onExport?: () => Promise<void> | void;
  label?: string;
  disabled?: boolean;
  title?: string;
  className?: string;
};

/**
 * PDFExport
 * - Shows a loading state while onExport runs
 * - Prevents double clicks
 * - Accessible focus/aria states
 */
export default function PDFExport({
  onExport,
  label = "Export as PDF",
  disabled = false,
  title = "Download a PDF copy",
  className = "",
}: PDFExportProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (disabled || loading) return;
    if (!onExport) return;

    try {
      setLoading(true);
      await onExport();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      title={title}
      aria-busy={loading ? "true" : "false"}
      aria-disabled={disabled || loading ? "true" : "false"}
      onClick={handleClick}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 font-semibold shadow
                  bg-blue-600 text-white hover:bg-blue-700 focus:outline-none
                  focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500
                  disabled:opacity-60 disabled:cursor-not-allowed
                  transition-colors ${className}`}
      disabled={disabled || loading}
    >
      {loading ? (
        <>
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 animate-spin"
            role="img"
            aria-label="Loading"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
            <path
              d="M12 2a10 10 0 0 1 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
          <span>Preparing PDF…</span>
        </>
      ) : (
        <>
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M12 3v10m0 0l-3-3m3 3l3-3M5 21h14a2 2 0 0 0 2-2v-5a0 0 0 0 0 0 0H3a0 0 0 0 0 0 0v5a2 2 0 0 0 2 2z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
