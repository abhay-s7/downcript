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
import { EXPORT_BTN_MAIN, EXPORT_BTN_CHEVRON, EXPORT_DROPDOWN, EXPORT_DROPDOWN_ITEM } from "@/app/lib/uiStyles";

interface ExportMenuProps {
  title: string;
  fileBaseName: string;
  segments: TranscriptSegment[];
  // Matches the transcript's own saved preference -- exports should reflect
  // how this transcript was generated, not a separate export-time choice.
  includeTimestamps?: boolean;
}

export default function ExportMenu({ title, fileBaseName, segments, includeTimestamps = false }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);

  async function handleExportDocx() {
    setExportingDocx(true);
    try {
      const blob = await buildSingleDocxBlob(title, segments, includeTimestamps);
      triggerDownload(blob, `${fileBaseName}.docx`);
    } finally {
      setExportingDocx(false);
    }
  }

  function handleExportTxt() {
    triggerTextDownload(buildTxt(title, segments, includeTimestamps), `${fileBaseName}.txt`, "text/plain");
    setOpen(false);
  }

  function handleExportSrt() {
    triggerTextDownload(buildSrt(segments), `${fileBaseName}.srt`, "application/x-subrip");
    setOpen(false);
  }

  return (
    <div className="relative inline-flex">
      <button onClick={handleExportDocx} disabled={exportingDocx} className={EXPORT_BTN_MAIN}>
        {exportingDocx ? "Exporting..." : "Export DOCX"}
      </button>
      <button onClick={() => setOpen((o) => !o)} className={EXPORT_BTN_CHEVRON} aria-label="More export formats">
        ▼
      </button>
      {open && (
        <div className={EXPORT_DROPDOWN}>
          <button onClick={handleExportTxt} className={EXPORT_DROPDOWN_ITEM}>
            TXT
          </button>
          <button onClick={handleExportSrt} className={EXPORT_DROPDOWN_ITEM}>
            SRT
          </button>
        </div>
      )}
    </div>
  );
}
