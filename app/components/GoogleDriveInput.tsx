"use client";

import { useState } from "react";
import { OutputFormat } from "@/app/lib/jobs";
import OutputFormatToggle from "@/app/components/OutputFormatToggle";

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
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Public Google Drive Folder
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
            className="flex-1 rounded-md border border-gray-300 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
          <button
            type="submit"
            disabled={scanning}
            className="rounded-md bg-blue-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {scanning ? "Scanning..." : "Scan Folder"}
          </button>
        </div>
      </form>

      {scanError && <p className="text-sm text-red-600 mt-3">{scanError}</p>}

      {files.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">
              Found {files.length} video{files.length === 1 ? "" : "s"}
            </p>
            <button
              onClick={selectAll}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Select All
            </button>
          </div>

          <div className="rounded-md border border-gray-200 divide-y divide-gray-100 max-h-56 overflow-y-auto mb-4">
            {files.map((f) => (
              <label
                key={f.id}
                className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={f.selected}
                  onChange={() => toggleFile(f.id)}
                  className="accent-blue-600"
                />
                <span className="truncate">{f.name}</span>
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <OutputFormatToggle value={outputFormat} onChange={onOutputFormatChange} />
            <button
              onClick={handleTranscribeSelected}
              disabled={selected.length === 0}
              className="rounded-md bg-blue-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Transcribe Selected
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
