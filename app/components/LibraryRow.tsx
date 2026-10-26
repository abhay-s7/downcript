"use client";

import { useState } from "react";
import { LibraryEntry } from "@/app/lib/services/library/types";
import { CARD, CHIP, CHIP_DANGER, LINK_MUTED, LINK_DANGER } from "@/app/lib/uiStyles";

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
    <div className={`${CARD} p-4 flex gap-4 transition-[border-color,box-shadow,transform] hover:border-line-2 hover:-translate-y-px hover:shadow-[0_18px_36px_-20px_rgba(20,24,40,.22),0_0_40px_-20px_var(--color-accent-glow)]`}>
      {entry.thumbnail ? (
        <img src={entry.thumbnail} alt="" className="w-20 h-14 object-cover rounded-[10px] flex-shrink-0" />
      ) : (
        <div className="w-20 h-14 rounded-[10px] bg-surface-3 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-medium text-text-3">{KIND_LABEL[entry.kind]}</span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className={CHIP}>{KIND_LABEL[entry.kind]}</span>
          {entry.platform && <span className="text-xs text-text-3">{entry.platform}</span>}
          {entry.status === "failed" && <span className={CHIP_DANGER}>Failed</span>}
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
              className="text-sm rounded-[8px] border border-line-2 px-2 py-1 flex-1 min-w-0 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
            <button onClick={submitRename} className="text-sm text-accent hover:text-text transition-colors flex-shrink-0">
              Save
            </button>
            <button onClick={() => setRenaming(false)} className="text-sm text-text-3 flex-shrink-0">
              Cancel
            </button>
          </div>
        ) : (
          <p className="text-[15px] font-medium text-text truncate" title={entry.fileName}>
            {entry.title || entry.fileName}
          </p>
        )}

        <p className="text-xs text-text-3 font-mono mt-0.5 truncate" title={entry.filePath}>
          {formatDate(entry.updatedAt)}
          {entry.sizeBytes ? ` · ${formatBytes(entry.sizeBytes)}` : ""}
          {entry.durationSeconds ? ` · ${formatDuration(entry.durationSeconds)}` : ""}
        </p>

        {entry.status === "failed" && entry.error && (
          <p className="text-xs text-danger mt-1 truncate" title={entry.error}>
            {entry.error}
          </p>
        )}

        {!renaming && (
          <div className="flex items-center gap-1 mt-1.5 -ml-2 flex-wrap">
            {entry.filePath && (
              <>
                <button onClick={onOpenFile} className={`${LINK_MUTED} px-2 py-1 rounded-[7px] hover:bg-black/[.04]`}>
                  Open
                </button>
                <button onClick={onOpenFolder} className={`${LINK_MUTED} px-2 py-1 rounded-[7px] hover:bg-black/[.04]`}>
                  Open folder
                </button>
                <button onClick={onCopyPath} className={`${LINK_MUTED} px-2 py-1 rounded-[7px] hover:bg-black/[.04]`}>
                  Copy path
                </button>
                <button onClick={() => setRenaming(true)} className={`${LINK_MUTED} px-2 py-1 rounded-[7px] hover:bg-black/[.04]`}>
                  Rename
                </button>
                {entry.kind === "video" && entry.status === "completed" && (
                  <button onClick={onTranscribe} className={`${LINK_MUTED} px-2 py-1 rounded-[7px] hover:bg-black/[.04]`}>
                    Transcribe
                  </button>
                )}
              </>
            )}

            {confirmingDelete ? (
              <span className="flex items-center gap-2 text-sm px-2">
                <span className="text-text-3">Delete:</span>
                {entry.filePath && (
                  <button onClick={() => onDelete(true)} className={LINK_DANGER}>
                    Move file to Trash
                  </button>
                )}
                <button onClick={() => onDelete(false)} className={LINK_MUTED}>
                  Remove record only
                </button>
                <button onClick={() => setConfirmingDelete(false)} className="text-text-3">
                  Cancel
                </button>
              </span>
            ) : (
              <button onClick={() => setConfirmingDelete(true)} className={`${LINK_DANGER} px-2 py-1 rounded-[7px] hover:bg-danger-soft`}>
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
