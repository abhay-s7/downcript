"use client";

import { useState } from "react";
import { useLibrary, LibrarySortKey, LibraryTypeFilter, LibraryStatusFilter } from "@/app/hooks/useLibrary";
import { useOutputDir } from "@/app/hooks/useOutputDir";
import LibraryRow from "@/app/components/LibraryRow";

const SORT_OPTIONS: Array<{ value: LibrarySortKey; label: string }> = [
  { value: "date", label: "Date" },
  { value: "name", label: "Name" },
  { value: "size", label: "Size" },
  { value: "type", label: "Type" },
  { value: "source", label: "Source" },
];

const TYPE_OPTIONS: Array<{ value: LibraryTypeFilter; label: string }> = [
  { value: "all", label: "All types" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "image", label: "Image" },
  { value: "transcript", label: "Transcript" },
];

const STATUS_OPTIONS: Array<{ value: LibraryStatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

export default function LibraryPanel() {
  const lib = useLibrary();
  const { outputDir, isDesktop } = useOutputDir();
  const [scanning, setScanning] = useState(false);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);

  async function handleScan() {
    if (!window.desktop) return;
    setScanning(true);
    try {
      const defaultDir = await window.desktop.defaultDownloadDir();
      const folders = [defaultDir];
      if (outputDir && outputDir !== defaultDir) folders.push(outputDir);
      await lib.scanFolders(folders);
    } finally {
      setScanning(false);
    }
  }

  if (!isDesktop) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
        The Media Library needs to run inside the desktop app — it isn&apos;t available in a plain
        browser tab.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <input
          type="text"
          value={lib.search}
          onChange={(e) => lib.setSearch(e.target.value)}
          placeholder="Search by title, filename, or source..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />

        <div className="mt-3 flex items-center gap-3 flex-wrap text-sm">
          <label className="flex items-center gap-1.5 text-gray-500">
            Sort
            <select
              value={lib.sortKey}
              onChange={(e) => lib.setSortKey(e.target.value as LibrarySortKey)}
              className="rounded-md border border-gray-300 px-2 py-1"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-gray-500">
            Type
            <select
              value={lib.typeFilter}
              onChange={(e) => lib.setTypeFilter(e.target.value as LibraryTypeFilter)}
              className="rounded-md border border-gray-300 px-2 py-1"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-gray-500">
            Status
            <select
              value={lib.statusFilter}
              onChange={(e) => lib.setStatusFilter(e.target.value as LibraryStatusFilter)}
              className="rounded-md border border-gray-300 px-2 py-1"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={handleScan}
            disabled={scanning}
            className="ml-auto text-blue-600 hover:underline disabled:text-gray-400"
          >
            {scanning ? "Scanning..." : "Scan for existing files"}
          </button>
        </div>
      </div>

      {lib.actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {lib.actionError}
        </div>
      )}

      {lib.loaded && lib.totalCount === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center">
          <p className="text-sm font-medium text-gray-900 mb-1">Nothing here yet</p>
          <p className="text-sm text-gray-500">
            Downloads, Meta Ads creatives, and transcript exports show up here automatically once
            you have some. Already have files from before? Try &quot;Scan for existing files&quot;
            above.
          </p>
        </div>
      )}

      {lib.loaded && lib.totalCount > 0 && lib.entries.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center">
          <p className="text-sm font-medium text-gray-900 mb-1">No matches</p>
          <p className="text-sm text-gray-500">
            Nothing matches your search and filters. Try clearing them.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {lib.entries.map((entry) => (
          <LibraryRow
            key={entry.id}
            entry={{ ...entry, title: transcribingId === entry.id ? `${entry.title || entry.fileName} (transcribing...)` : entry.title }}
            onOpenFile={() => lib.openFile(entry)}
            onOpenFolder={() => lib.openFolder(entry)}
            onCopyPath={() => lib.copyPath(entry)}
            onRename={(newBaseName) => lib.rename(entry, newBaseName)}
            onDelete={(deleteFile) => lib.remove(entry, deleteFile)}
            onTranscribe={async () => {
              setTranscribingId(entry.id);
              try {
                await lib.reprocessTranscript(entry, "hinglish", ["docx"]);
              } finally {
                setTranscribingId(null);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
