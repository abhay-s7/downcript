"use client";

import { Mode } from "@/app/lib/uiTypes";

const OPTIONS: { value: Mode; label: string }[] = [
  { value: "youtube", label: "YouTube" },
  { value: "instagram", label: "Instagram" },
  { value: "dailymotion", label: "Dailymotion" },
  { value: "upload", label: "Upload" },
  { value: "drive", label: "Google Drive" },
];

export default function SourceSelector({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (mode: Mode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Transcription source"
      className="inline-flex flex-nowrap overflow-x-auto max-w-full rounded-lg border border-gray-200 bg-gray-50 p-1 gap-1"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={mode === opt.value}
          onClick={() => onChange(opt.value)}
          className={`whitespace-nowrap px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === opt.value
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
