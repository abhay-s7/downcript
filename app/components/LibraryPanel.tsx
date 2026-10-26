"use client";

import { useState } from "react";
import { useLibrary, LibrarySortKey, LibraryTypeFilter, LibraryStatusFilter } from "@/app/hooks/useLibrary";
import { useOutputDir } from "@/app/hooks/useOutputDir";
import LibraryRow from "@/app/components/LibraryRow";
import { CARD, INPUT, SELECT_SM, LINK, EMPTY_CARD } from "@/app/lib/uiStyles";

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

function formatSize(bytes: number): string {
  if (!bytes) return "0 MB";
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

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
      <div className={`${CARD} p-6 text-sm text-text-2`}>
        The Media Library needs to run inside the desktop app — it isn&apos;t available in a plain
        browser tab.
      </div>
    );
  }

  const transcriptCount = lib.entries.filter((e) => e.kind === "transcript").length;

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-[11px] tracking-[.14em] uppercase text-accent mb-3.5">Library</p>
        <h1 className="font-medium text-[clamp(32px,4vw,46px)] leading-[1.05] tracking-[-.04em] mb-5">
          <span className="bg-gradient-to-r from-text from-20% to-text-3 bg-clip-text text-transparent">
            Everything you&apos;ve saved.
          </span>
        </h1>
        <p className="text-text-2 text-[15.5px] max-w-[540px]">Videos, audio and transcripts — searchable, in one place.</p>
      </div>

      <div className="grid grid-cols-3 gap-3.5">
        <div className={`${CARD} p-5`}>
          <b className="block font-medium text-[28px] tracking-[-.04em] text-text">{lib.totalCount}</b>
          <span className="text-xs text-text-3">Items</span>
        </div>
        <div className={`${CARD} p-5`}>
          <b className="block font-medium text-[28px] tracking-[-.04em] text-text">{formatSize(lib.totalSizeBytes)}</b>
          <span className="text-xs text-text-3">On disk</span>
        </div>
        <div className={`${CARD} p-5`}>
          <b className="block font-medium text-[28px] tracking-[-.04em] text-text">{transcriptCount}</b>
          <span className="text-xs text-text-3">Transcripts</span>
        </div>
      </div>

      <div className={`${CARD} p-4`}>
        <input
          type="text"
          value={lib.search}
          onChange={(e) => lib.setSearch(e.target.value)}
          placeholder="Search by title, filename, or source…"
          className={`${INPUT} h-10`}
        />

        <div className="mt-3.5 flex items-center gap-4 flex-wrap text-sm">
          <label className="flex items-center gap-2 text-text-3">
            Sort
            <select value={lib.sortKey} onChange={(e) => lib.setSortKey(e.target.value as LibrarySortKey)} className={SELECT_SM}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-text-3">
            Type
            <select value={lib.typeFilter} onChange={(e) => lib.setTypeFilter(e.target.value as LibraryTypeFilter)} className={SELECT_SM}>
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-text-3">
            Status
            <select value={lib.statusFilter} onChange={(e) => lib.setStatusFilter(e.target.value as LibraryStatusFilter)} className={SELECT_SM}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <button onClick={handleScan} disabled={scanning} className={`ml-auto ${LINK} disabled:text-text-3`}>
            {scanning ? "Scanning..." : "Scan for existing files"}
          </button>
        </div>
      </div>

      {lib.actionError && (
        <div className="rounded-2xl border border-danger/25 bg-danger-soft px-4 py-2.5 text-sm text-danger">
          {lib.actionError}
        </div>
      )}

      {lib.loaded && lib.totalCount === 0 && (
        <div className={EMPTY_CARD}>
          <p className="text-sm font-medium text-text mb-1">Nothing here yet</p>
          <p className="text-sm text-text-2">
            Downloads, Meta Ads creatives, and transcript exports show up here automatically once
            you have some. Already have files from before? Try &quot;Scan for existing files&quot;
            above.
          </p>
        </div>
      )}

      {lib.loaded && lib.totalCount > 0 && lib.entries.length === 0 && (
        <div className={EMPTY_CARD}>
          <p className="text-sm font-medium text-text mb-1">No matches</p>
          <p className="text-sm text-text-2">Nothing matches your search and filters. Try clearing them.</p>
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
