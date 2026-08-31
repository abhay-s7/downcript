"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LibraryEntry, MediaKind } from "@/app/lib/services/library/types";
import { TranscriptFormat } from "@/app/lib/services/meta/types";

export type LibrarySortKey = "date" | "name" | "size" | "type" | "source";
export type LibraryTypeFilter = "all" | MediaKind;
export type LibraryStatusFilter = "all" | "completed" | "failed";

function stripExtension(name: string): string {
  return name.replace(/\.[^/.]+$/, "");
}

// The library's own list + search/sort/filter UI state, backed by the
// Electron main process's library.json store (see electron/main.js) rather
// than component state -- window.desktop.library.onChanged fires whenever
// ANY tab registers/removes an entry, including ones this component never
// touched directly, so switching to the Library tab always shows the latest
// state instead of a snapshot taken whenever this hook happened to mount.
export function useLibrary() {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<LibrarySortKey>("date");
  const [typeFilter, setTypeFilter] = useState<LibraryTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<LibraryStatusFilter>("all");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.desktop) return;
    void window.desktop.library.list().then((list) => {
      setEntries(list);
      setLoaded(true);
    });
    return window.desktop.library.onChanged(setEntries);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = entries.filter((e) => {
      if (typeFilter !== "all" && e.kind !== typeFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (!q) return true;
      return (
        e.fileName.toLowerCase().includes(q) ||
        e.title?.toLowerCase().includes(q) ||
        e.platform?.toLowerCase().includes(q) ||
        e.sourceUrl?.toLowerCase().includes(q)
      );
    });

    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return (a.title || a.fileName).localeCompare(b.title || b.fileName);
        case "size":
          return (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0);
        case "type":
          return a.kind.localeCompare(b.kind);
        case "source":
          return (a.platform || "").localeCompare(b.platform || "");
        case "date":
        default:
          return b.updatedAt - a.updatedAt;
      }
    });

    return list;
  }, [entries, search, typeFilter, statusFilter, sortKey]);

  const runAction = useCallback(async (fn: () => Promise<void>) => {
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }, []);

  const openFile = useCallback(
    (entry: LibraryEntry) =>
      runAction(async () => {
        if (!entry.filePath || !window.desktop) return;
        const result = await window.desktop.library.openFile(entry.filePath);
        if (result) throw new Error(result);
      }),
    [runAction]
  );

  const openFolder = useCallback(
    (entry: LibraryEntry) =>
      runAction(async () => {
        if (!entry.filePath || !window.desktop) return;
        await window.desktop.library.openFolder(entry.filePath);
      }),
    [runAction]
  );

  const copyPath = useCallback(
    (entry: LibraryEntry) =>
      runAction(async () => {
        if (!entry.filePath) return;
        await navigator.clipboard.writeText(entry.filePath);
      }),
    [runAction]
  );

  const rename = useCallback(
    (entry: LibraryEntry, newBaseName: string) =>
      runAction(async () => {
        if (!window.desktop) return;
        await window.desktop.library.rename(entry.id, newBaseName);
      }),
    [runAction]
  );

  const remove = useCallback(
    (entry: LibraryEntry, deleteFile: boolean) =>
      runAction(async () => {
        if (!window.desktop) return;
        await window.desktop.library.remove(entry.id, { deleteFile });
      }),
    [runAction]
  );

  // "Reprocess/transcribe": reuses the same server route Meta Ads' video
  // creatives already transcribe through (/api/meta-transcribe accepts a
  // bare videoPath + transcriptBaseName with no Meta-specific requirement),
  // so any video-kind library entry -- regardless of which tab produced it
  // -- can be sent through it without a new backend route.
  const reprocessTranscript = useCallback(
    (entry: LibraryEntry, outputFormat: "original" | "hinglish", formats: TranscriptFormat[]) =>
      runAction(async () => {
        if (!entry.filePath || entry.kind !== "video") {
          throw new Error("Only downloaded videos can be transcribed.");
        }
        const res = await fetch("/api/meta-transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoPath: entry.filePath,
            transcriptBaseName: stripExtension(entry.fileName),
            outputFormat,
            formats,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Transcription failed.");

        const paths = (data.paths || {}) as Partial<Record<TranscriptFormat, string>>;
        for (const filePath of Object.values(paths)) {
          if (!filePath || !window.desktop) continue;
          const fileName = filePath.split(/[/\\]/).pop() || filePath;
          void window.desktop.library.upsert({
            id: filePath,
            filePath,
            fileName,
            title: entry.title || stripExtension(entry.fileName),
            sourceModule: "transcript-export",
            platform: entry.platform,
            sourceUrl: entry.sourceUrl,
            kind: "transcript",
            ext: fileName.split(".").pop() || "",
            status: "completed",
          });
        }
      }),
    [runAction]
  );

  const scanFolders = useCallback(
    (folders: string[]) =>
      runAction(async () => {
        if (!window.desktop) return;
        await window.desktop.library.scanFolders(folders);
      }),
    [runAction]
  );

  return {
    entries: filtered,
    totalCount: entries.length,
    loaded,
    search,
    setSearch,
    sortKey,
    setSortKey,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    actionError,
    openFile,
    openFolder,
    copyPath,
    rename,
    remove,
    reprocessTranscript,
    scanFolders,
  };
}
