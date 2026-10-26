"use client";

import { OutputFormat } from "@/app/lib/jobs";
import { SEG, SEG_BTN, SEG_BTN_ON } from "@/app/lib/uiStyles";

export default function OutputFormatToggle({
  value,
  onChange,
}: {
  value: OutputFormat;
  onChange: (format: OutputFormat) => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-sm text-text-3">Output</span>
      <div className={SEG}>
        <button type="button" onClick={() => onChange("original")} className={value === "original" ? SEG_BTN_ON : SEG_BTN}>
          Original
        </button>
        <button type="button" onClick={() => onChange("hinglish")} className={value === "hinglish" ? SEG_BTN_ON : SEG_BTN}>
          Hinglish
        </button>
      </div>
    </div>
  );
}
