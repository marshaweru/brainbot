// apps/web/components/AudioRecorder.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  onAudio?: (file: File) => void; // receives a recorded file
  maxMs?: number;                 // default 120_000 (2 minutes)
  filename?: string;              // default "answer"
};

function pickMimeType(): string {
  // Prefer opus-in-webm; fall back to ogg, mp4, then raw webm
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/mp4",                  // iOS/Safari sometimes supports this
    "audio/webm",
  ];
  for (const t of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(t)) {
      return t;
    }
  }
  // As a last resort, let the browser choose
  return "";
}

export default function AudioRecorder({ onAudio, maxMs = 120_000, filename = "answer" }: Props) {
  const [supported, setSupported] = useState<boolean>(true);
  const [recording, setRecording] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  // Detect support on mount
  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined";
    setSupported(ok);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopInternal(false);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl]);

  const stopInternal = (emit = true) => {
    // stop timer
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // stop recorder
    try {
      mediaRecorderRef.current?.stop();
    } catch {}
    mediaRecorderRef.current = null;

    // stop tracks
    streamRef.current?.getTracks().forEach((t) => {
      try { t.stop(); } catch {}
    });
    streamRef.current = null;

    setRecording(false);

    if (!emit) return;

    // assemble blob -> file -> preview
    const type = pickMimeType() || "audio/webm";
    const blob = new Blob(chunksRef.current, { type });
    chunksRef.current = [];

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);

    if (onAudio) {
      // derive an extension from mime
      const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
      const file = new File([blob], `${filename}.${ext}`, { type });
      onAudio(file);
    }
  };

  const startRecording = useCallback(async () => {
    setErr(null);
    if (!supported || recording) return;

    try {
      // Request mic with echo cancellation for clarity
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => stopInternal(true);

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // gather data every second
      setRecording(true);

      // Auto-stop at maxMs
      timerRef.current = window.setTimeout(() => {
        stopInternal(true);
      }, Math.max(1_000, maxMs));
    } catch (e: any) {
      setErr(
        e?.name === "NotAllowedError"
          ? "Mic permission denied. Enable microphone access in your browser settings."
          : e?.name === "NotFoundError"
          ? "No microphone found."
          : "Unable to access microphone."
      );
      setRecording(false);
      // best-effort cleanup
      try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
      streamRef.current = null;
    }
  }, [supported, recording, maxMs]);

  const stopRecording = () => {
    // onstop handler will finalize & emit
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    } else {
      stopInternal(true);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={recording ? stopRecording : startRecording}
        disabled={!supported}
        className={`rounded-2xl px-5 py-2 font-bold text-white transition active:scale-95
          ${!supported ? "opacity-50 cursor-not-allowed bg-white/20" : recording ? "bg-rose-500 hover:bg-rose-400" : "bg-gold-500 text-ink-900 hover:bg-gold-400"}
        `}
      >
        {recording ? "Stop Recording" : "Start Recording"}
      </button>

      <span className="text-xs text-steel-300">
        {recording ? "Recording… auto-stops at 2 min." : "Max 2 minutes per answer."}
      </span>

      {err && <span className="text-xs text-rose-300">{err}</span>}

      {previewUrl && !recording && (
        <audio
          controls
          src={previewUrl}
          className="mt-2 w-64 max-w-full"
        />
      )}
    </div>
  );
}
