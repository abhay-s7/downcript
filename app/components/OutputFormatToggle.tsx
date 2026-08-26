"use client";

import { OutputFormat } from "@/app/lib/jobs";

export default function OutputFormatToggle({
  value,
  onChange,
}: {
  value: OutputFormat;
  onChange: (format: OutputFormat) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">Output</span>
      <div className="inline-flex rounded-md border border-gray-200 p-0.5">
        <button
          type="button"
          onClick={() => onChange("original")}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            value === "original" ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Original
        </button>
        <button
          type="button"
          onClick={() => onChange("hinglish")}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            value === "hinglish" ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Hinglish
        </button>
      </div>
    </div>
  );
}
