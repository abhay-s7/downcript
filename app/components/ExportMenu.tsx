"use client";

import { useState } from "react";
import { TranscriptSegment } from "@/app/types";
import {
  buildSingleDocxBlob,
  buildSrt,
  buildTxt,
  triggerDownload,
  triggerTextDownload,
} from "@/app/lib/export";

interface ExportMenuProps {
  title: string;
  fileBaseName: string;
  segments: TranscriptSegment[];
}

export default function ExportMenu({ title, fileBaseName, segments }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);

  async function handleExportDocx() {
    setExportingDocx(true);
    try {
      const blob = await buildSingleDocxBlob(title, segments);
      triggerDownload(blob, `${fileBaseName}.docx`);
    } finally {
      setExportingDocx(false);
    }
  }

  function handleExportTxt() {
    triggerTextDownload(buildTxt(title, segments), `${fileBaseName}.txt`, "text/plain");
    setOpen(false);
  }

  function handleExportSrt() {
    triggerTextDownload(buildSrt(segments), `${fileBaseName}.srt`, "application/x-subrip");
    setOpen(false);
  }

  return (
    <div className="relative inline-flex">
      <button
        onClick={handleExportDocx}
        disabled={exportingDocx}
        className="bg-blue-600 text-white px-3 py-1.5 rounded-l text-sm disabled:opacity-50"
      >
        {exportingDocx ? "Exporting..." : "Export DOCX"}
      </button>
      <button
        onClick={() => setOpen((o) => !o)}
        className="bg-blue-600 text-white px-2 py-1.5 rounded-r border-l border-blue-500 text-sm"
        aria-label="More export formats"
      >
        ▼
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border rounded shadow z-10 min-w-[100px]">
          <button
            onClick={handleExportTxt}
            className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            TXT
          </button>
          <button
            onClick={handleExportSrt}
            className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            SRT
          </button>
        </div>
      )}
    </div>
  );
}
