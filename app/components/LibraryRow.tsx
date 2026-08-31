"use client";

import { useState } from "react";
import { LibraryEntry } from "@/app/lib/services/library/types";

const ACTION_BUTTON = "text-sm text-gray-500 hover:text-gray-900 transition-colors";
const KIND_LABEL: Record<LibraryEntry["kind"], string> = {
  video: "Video",
  audio: "Audio",
  image: "Image",
  transcript: "Transcript",
  other: "File",
};

function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  const mb = bytes / 1024 / 1024;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 0.1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function LibraryRow({
  entry,
  onOpenFile,
  onOpenFolder,
  onCopyPath,
  onRename,
  onDelete,
  onTranscribe,
}: {
  entry: LibraryEntry;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onCopyPath: () => void;
  onRename: (newBaseName: string) => void;
  onDelete: (deleteFile: boolean) => void;
  onTranscribe: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(() => entry.fileName.replace(/\.[^/.]+$/, ""));
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function submitRename() {
    setRenaming(false);
    if (renameValue.trim()) onRename(renameValue.trim());
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 flex gap-4">
      {entry.thumbnail ? (
        <img src={entry.thumbnail} alt="" className="w-20 h-14 object-cover rounded-md flex-shrink-0" />
      ) : (
        <div className="w-20 h-14 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-medium text-gray-400">{KIND_LABEL[entry.kind]}</span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
            {KIND_LABEL[entry.kind]}
          </span>
          {entry.platform && <span className="text-xs text-gray-400">{entry.platform}</span>}
          {entry.status === "failed" && (
            <span className="text-xs font-medium text-red-600 bg-red-50 rounded px-1.5 py-0.5">Failed</span>
          )}
        </div>

        {renaming ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              className="text-sm rounded-md border border-gray-300 px-2 py-1 flex-1 min-w-0"
            />
            <button onClick={submitRename} className="text-sm text-blue-600 hover:underline flex-shrink-0">
              Save
            </button>
            <button onClick={() => setRenaming(false)} className="text-sm text-gray-400 flex-shrink-0">
              Cancel
            </button>
          </div>
        ) : (
          <p className="text-sm font-medium text-gray-900 truncate" title={entry.fileName}>
            {entry.title || entry.fileName}
          </p>
        )}

        <p className="text-xs text-gray-400 mt-0.5 truncate" title={entry.filePath}>
          {formatDate(entry.updatedAt)}
          {entry.sizeBytes ? ` · ${formatBytes(entry.sizeBytes)}` : ""}
          {entry.durationSeconds ? ` · ${formatDuration(entry.durationSeconds)}` : ""}
        </p>

        {entry.status === "failed" && entry.error && (
          <p className="text-xs text-red-600 mt-1 truncate" title={entry.error}>
            {entry.error}
          </p>
        )}

        {!renaming && (
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {entry.filePath && (
              <>
                <button onClick={onOpenFile} className={ACTION_BUTTON}>
                  Open
                </button>
                <button onClick={onOpenFolder} className={ACTION_BUTTON}>
                  Open folder
                </button>
                <button onClick={onCopyPath} className={ACTION_BUTTON}>
                  Copy path
                </button>
                <button onClick={() => setRenaming(true)} className={ACTION_BUTTON}>
                  Rename
                </button>
                {entry.kind === "video" && entry.status === "completed" && (
                  <button onClick={onTranscribe} className={ACTION_BUTTON}>
                    Transcribe
                  </button>
                )}
              </>
            )}

            {confirmingDelete ? (
              <span className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Delete:</span>
                {entry.filePath && (
                  <button onClick={() => onDelete(true)} className="text-red-600 hover:underline">
                    Move file to Trash
                  </button>
                )}
                <button onClick={() => onDelete(false)} className="text-gray-500 hover:underline">
                  Remove record only
                </button>
                <button onClick={() => setConfirmingDelete(false)} className="text-gray-400">
                  Cancel
                </button>
              </span>
            ) : (
              <button onClick={() => setConfirmingDelete(true)} className={`${ACTION_BUTTON} text-red-600 hover:text-red-800`}>
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
