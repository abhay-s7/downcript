"use client";

import { useState } from "react";
import {
  buildCombinedDocxBlob,
  buildCombinedSrt,
  buildCombinedTxt,
  ExportableVideo,
  triggerDownload,
  triggerTextDownload,
} from "@/app/lib/export";
import { EXPORT_BTN_MAIN, EXPORT_BTN_CHEVRON, EXPORT_DROPDOWN, EXPORT_DROPDOWN_ITEM } from "@/app/lib/uiStyles";

export default function ExportAllMenu({ videos }: { videos: ExportableVideo[] }) {
  const [open, setOpen] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);

  if (videos.length === 0) return null;

  async function handleExportDocx() {
    setExportingDocx(true);
    try {
      const blob = await buildCombinedDocxBlob(videos);
      triggerDownload(blob, "google-drive-transcripts.docx");
    } finally {
      setExportingDocx(false);
    }
  }

  function handleExportTxt() {
    triggerTextDownload(buildCombinedTxt(videos), "google-drive-transcripts.txt", "text/plain");
    setOpen(false);
  }

  function handleExportSrt() {
    triggerTextDownload(
      buildCombinedSrt(videos),
      "google-drive-transcripts.srt",
      "application/x-subrip"
    );
    setOpen(false);
  }

  return (
    <div className="relative inline-flex">
      <button onClick={handleExportDocx} disabled={exportingDocx} className={EXPORT_BTN_MAIN}>
        {exportingDocx ? "Exporting..." : "Export All DOCX"}
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
