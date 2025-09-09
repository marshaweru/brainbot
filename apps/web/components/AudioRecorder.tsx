"use client";
import { useRef, useState } from "react";

export default function AudioRecorder({ onAudio }: { onAudio?: (file: File) => void }) {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<any[]>([]);

  const startRecording = async () => {
    setRecording(true);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      if (onAudio) onAudio(new File([blob], "answer.webm", { type: "audio/webm" }));
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
  };

  const stopRecording = () => {
    setRecording(false);
    mediaRecorderRef.current?.stop();
  };

  return (
    <div className="flex flex-col items-center">
      <button
        className={`rounded-xl px-5 py-2 font-bold text-white ${
          recording ? "bg-red-500" : "bg-blue-500"
        }`}
        onClick={recording ? stopRecording : startRecording}
        type="button"
      >
        {recording ? "Stop Recording" : "Start Recording"}
      </button>
      <span className="text-xs mt-1 text-gray-400">
        {recording ? "Recording..." : "Max 2 minutes per answer."}
      </span>
    </div>
  );
}
