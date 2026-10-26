"use client";

import { Mode } from "@/app/lib/uiTypes";
import { TABSTRIP, TABSTRIP_BTN, TABSTRIP_BTN_ON } from "@/app/lib/uiStyles";

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
    <div role="tablist" aria-label="Transcription source" className={`${TABSTRIP} overflow-x-auto`}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={mode === opt.value}
          onClick={() => onChange(opt.value)}
          className={`whitespace-nowrap ${mode === opt.value ? TABSTRIP_BTN_ON : TABSTRIP_BTN}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
