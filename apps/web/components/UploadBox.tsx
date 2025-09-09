import { useRef } from "react";

export default function UploadBox({ onUpload }: { onUpload?: (file: File) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-blue-50 dark:bg-gray-900 rounded-2xl p-5 flex flex-col items-center border border-blue-100 shadow">
      <span className="font-bold text-blue-700 mb-2">Upload your answer (photo, audio, or PDF)</span>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,audio/*,application/pdf"
        className="mb-2"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f && onUpload) onUpload(f);
        }}
      />
      <button
        type="button"
        className="bg-brand-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700"
        onClick={() => fileRef.current?.click()}
      >
        Select File
      </button>
      <div className="text-xs text-gray-400 mt-2">
        Max size: 5MB. Supported: JPG, PNG, PDF, MP3, WAV.
      </div>
    </div>
  );
}
