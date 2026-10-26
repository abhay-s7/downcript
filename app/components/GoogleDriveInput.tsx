"use client";

import { useState } from "react";
import { OutputFormat } from "@/app/lib/jobs";
import OutputFormatToggle from "@/app/components/OutputFormatToggle";
import { LABEL, INPUT, BTN_PRIMARY, LINK, CHECK_INPUT } from "@/app/lib/uiStyles";

interface DriveFile {
  id: string;
  name: string;
  selected: boolean;
}

function extractResourceKey(url: string): string | null {
  try {
    return new URL(url.trim()).searchParams.get("resourcekey");
  } catch {
    return null;
  }
}

export default function GoogleDriveInput({
  outputFormat,
  onOutputFormatChange,
  onSubmit,
}: {
  outputFormat: OutputFormat;
  onOutputFormatChange: (format: OutputFormat) => void;
  onSubmit: (files: { id: string; name: string }[], resourceKey: string | null) => void;
}) {
  const [url, setUrl] = useState("");
  const [resourceKey, setResourceKey] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    setScanError("");
    setFiles([]);
    setScanning(true);

    try {
      const res = await fetch("/api/drive-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (!res.ok) {
        setScanError(data.error || "Something went wrong.");
      } else {
        setResourceKey(extractResourceKey(url));
        setFiles(
          (data.files as { id: string; name: string }[]).map((f) => ({ ...f, selected: true }))
        );
      }
    } catch {
      setScanError("Could not reach the server.");
    } finally {
      setScanning(false);
    }
  }

  function toggleFile(id: string) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, selected: !f.selected } : f)));
  }

  function selectAll() {
    setFiles((prev) => prev.map((f) => ({ ...f, selected: true })));
  }

  const selected = files.filter((f) => f.selected);

  function handleTranscribeSelected() {
    if (selected.length === 0) return;
    onSubmit(selected, resourceKey);
  }

  return (
    <div>
      <form onSubmit={handleScan}>
        <label className={LABEL}>Public Google Drive Folder</label>
        <div className="flex gap-2.5">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/…"
            className={INPUT}
            required
          />
          <button type="submit" disabled={scanning} className={BTN_PRIMARY}>
            {scanning ? "Scanning…" : "Scan Folder"}
          </button>
        </div>
      </form>

      {scanError && <p className="text-sm text-danger mt-3">{scanError}</p>}

      {files.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-text-2">
              Found {files.length} video{files.length === 1 ? "" : "s"}
            </p>
            <button onClick={selectAll} className={`${LINK} font-medium`}>
              Select All
            </button>
          </div>

          <div className="rounded-[10px] border border-line divide-y divide-line max-h-56 overflow-y-auto mb-4">
            {files.map((f) => (
              <label key={f.id} className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-text-2 cursor-pointer hover:bg-bg-2">
                <input type="checkbox" checked={f.selected} onChange={() => toggleFile(f.id)} className={CHECK_INPUT} />
                <span className="truncate">{f.name}</span>
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <OutputFormatToggle value={outputFormat} onChange={onOutputFormatChange} />
            <button onClick={handleTranscribeSelected} disabled={selected.length === 0} className={BTN_PRIMARY}>
              Transcribe Selected
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
