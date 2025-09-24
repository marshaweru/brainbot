// apps/web/components/UploadBox.tsx
"use client";
import { useCallback, useRef, useState } from "react";

type Props = {
  onUpload?: (file: File) => void | Promise<void>;
  maxSizeMB?: number; // default 5
};

const ACCEPT =
  "image/*,audio/*,application/pdf";
const FRIENDLY_TYPES = "JPG, PNG, PDF, MP3, WAV";

export default function UploadBox({ onUpload, maxSizeMB = 5 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hover, setHover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string>("");

  const maxBytes = maxSizeMB * 1024 * 1024;

  const validate = (file: File) => {
    if (!file) return "No file selected.";
    if (file.size > maxBytes)
      return `File is too large (${formatSize(file.size)}). Max ${maxSizeMB} MB.`;
    // basic mime sanity; accept already filters most cases
    if (!/^(image\/|audio\/|application\/pdf$)/.test(file.type))
      return `Unsupported type: ${file.type || "unknown"}. Allowed: ${FRIENDLY_TYPES}.`;
    return "";
  };

  const handleFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      const msg = validate(file);
      setError(msg);
      if (msg) return;

      setBusy(true);
      setFileName(file.name);
      try {
        await onUpload?.(file);
      } catch (e: any) {
        setError(String(e?.message || e) || "Upload failed.");
      } finally {
        setBusy(false);
      }
    },
    [onUpload]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.currentTarget.files?.[0];
    // Clear the value so selecting the same file again will retrigger onChange
    e.currentTarget.value = "";
    void handleFile(f);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setHover(false);
    void handleFile(e.dataTransfer.files?.[0]);
  };

  const onKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload answer (photo, audio, or PDF). Press Enter to select a file or drag and drop."
        className={[
          "rounded-2xl p-5 border shadow transition-colors",
          "bg-blue-50 dark:bg-gray-900 border-blue-100",
          hover ? "ring-2 ring-brand-500 border-brand-500/50" : "",
          busy ? "opacity-80" : "",
          "flex flex-col items-center"
        ].join(" ")}
        onDragOver={(e) => {
          e.preventDefault();
          setHover(true);
        }}
        onDragLeave={() => setHover(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={onKeyPress}
      >
        <span className="font-bold text-blue-700 dark:text-blue-200 mb-2 text-center">
          Upload your answer (photo, audio, or PDF)
        </span>

        {/* Hidden input */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          // capture helps mobile open camera/mic; browsers ignore if not applicable
          capture="environment"
          className="sr-only"
          onChange={onInputChange}
          aria-hidden
          tabIndex={-1}
        />

        <div className="flex gap-2">
          <button
            type="button"
            className="bg-brand-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-brand-600 disabled:opacity-60"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
            disabled={busy}
          >
            {busy ? "Uploading…" : "Select File"}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg border border-blue-200 dark:border-white/20 hover:bg-white/5"
            onClick={(e) => {
              e.stopPropagation();
              // For mobile: open camera quickly for images
              // Some browsers require inputRef.click with accept=image/*
              // We’ll temporarily narrow accept to images for this click
              const el = inputRef.current;
              if (!el) return;
              const prev = el.accept;
              el.accept = "image/*";
              el.click();
              // restore on next tick
              setTimeout(() => { if (el) el.accept = prev; }, 0);
            }}
            disabled={busy}
            title="Open camera (on mobile) or image picker"
          >
            Use Camera
          </button>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
          Max size: {maxSizeMB} MB. Supported: {FRIENDLY_TYPES}.
        </div>

        {fileName && !error && (
          <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
            Selected: <span className="font-medium">{fileName}</span>
          </div>
        )}

        {error && (
          <div className="mt-2 text-xs text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
