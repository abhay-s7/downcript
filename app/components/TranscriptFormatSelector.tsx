"use client";

import { TRANSCRIPT_FORMATS, TranscriptFormat } from "@/app/lib/services/meta/types";

const LABELS: Record<TranscriptFormat, string> = { txt: "TXT", docx: "DOCX", srt: "SRT" };

export default function TranscriptFormatSelector({
  selected,
  onChange,
}: {
  selected: Set<TranscriptFormat>;
  onChange: (next: Set<TranscriptFormat>) => void;
}) {
  // Select All has no stored state of its own -- it's derived from whether
  // every format happens to be selected, so unchecking any one format
  // naturally un-checks it too, with no extra bookkeeping.
  const allSelected = TRANSCRIPT_FORMATS.every((f) => selected.has(f));

  function toggleFormat(format: TranscriptFormat) {
    const next = new Set(selected);
    if (next.has(format)) next.delete(format);
    else next.add(format);
    onChange(next);
  }

  function toggleAll() {
    onChange(allSelected ? new Set() : new Set(TRANSCRIPT_FORMATS));
  }

  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="text-gray-500">Transcript format</span>
      <label className="flex items-center gap-1.5 cursor-pointer text-gray-700">
        <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-blue-600" />
        Select All
      </label>
      {TRANSCRIPT_FORMATS.map((format) => (
        <label key={format} className="flex items-center gap-1.5 cursor-pointer text-gray-700">
          <input
            type="checkbox"
            checked={selected.has(format)}
            onChange={() => toggleFormat(format)}
            className="accent-blue-600"
          />
          {LABELS[format]}
        </label>
      ))}
    </div>
  );
}
