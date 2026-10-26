"use client";

import { DownloadCard as DownloadCardModel, DownloadFormatSelection } from "@/app/lib/downloadJobs";
import { CARD, CHIP, SELECT_SM, BTN_PRIMARY_SM, BTN_GHOST_SM, LINK, LINK_MUTED, PROGRESS_TRACK, PROGRESS_FILL } from "@/app/lib/uiStyles";

function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function DownloadCard({
  card,
  onSetFormat,
  onStartDownload,
  onPause,
  onResume,
  onRetryDownload,
  onCancel,
  onRetryInfo,
  onRemove,
}: {
  card: DownloadCardModel;
  onSetFormat: (format: DownloadFormatSelection) => void;
  onStartDownload: () => void;
  onPause: () => void;
  onResume: () => void;
  onRetryDownload: () => void;
  onCancel: () => void;
  onRetryInfo: () => void;
  onRemove: () => void;
}) {
  const selectedValue =
    card.selectedFormat === "audio" ? "audio" : card.selectedFormat === "best" ? "best" : String(card.selectedFormat.height);

  return (
    <div className={`${CARD} p-4 flex gap-4`}>
      {card.thumbnail ? (
        <img src={card.thumbnail} alt="" className="w-28 h-16 object-cover rounded-[10px] flex-shrink-0" />
      ) : (
        <div className="w-28 h-16 rounded-[10px] bg-surface-3 flex-shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={CHIP}>{card.platform}</span>
          {card.duration ? <span className="text-xs text-text-3 font-mono">{formatDuration(card.duration)}</span> : null}
        </div>

        <p className="text-sm font-medium text-text truncate">{card.title || card.url}</p>

        {card.status === "loading" && <p className="text-sm text-text-3 mt-1">Analyzing...</p>}

        {card.status === "info-error" && (
          <div className="mt-1">
            <p className="text-sm text-danger">{card.error}</p>
            <button onClick={onRetryInfo} className={`${LINK} mt-1`}>
              Retry
            </button>
          </div>
        )}

        {card.status === "ready" && (
          <div className="mt-2.5 flex items-center gap-2">
            <select
              value={selectedValue}
              onChange={(e) => {
                const v = e.target.value;
                onSetFormat(v === "audio" ? "audio" : v === "best" ? "best" : { height: Number(v) });
              }}
              className={SELECT_SM}
            >
              <option value="best">Best video quality</option>
              {card.formats?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
              <option value="audio">Audio only (MP3)</option>
            </select>
            <button onClick={onStartDownload} className={BTN_PRIMARY_SM}>
              Download
            </button>
          </div>
        )}

        {card.status === "queued" && <p className="text-sm text-text-3 mt-1">Queued...</p>}

        {card.status === "preparing" && <p className="text-sm text-text-3 mt-1">Preparing...</p>}

        {card.status === "downloading" && (
          <div className="mt-2.5">
            <div className={PROGRESS_TRACK}>
              <div className={PROGRESS_FILL} style={{ width: `${Math.min(99, card.progress?.percent ?? 0)}%` }} />
            </div>
            <p className="text-xs text-text-3 font-mono mt-1.5">
              {Math.floor(card.progress?.percent ?? 0)}%
              {card.progress?.speedBytesPerSec ? ` · ${formatBytes(card.progress.speedBytesPerSec)}/s` : ""}
              {card.progress?.downloadedBytes && card.progress?.totalBytes
                ? ` · ${formatBytes(card.progress.downloadedBytes)} / ${formatBytes(card.progress.totalBytes)}`
                : ""}
            </p>
          </div>
        )}

        {card.status === "processing" && (
          <div className="mt-2.5">
            <div className={PROGRESS_TRACK}>
              <div className={`${PROGRESS_FILL} animate-pulse`} style={{ width: "100%" }} />
            </div>
            <p className="text-xs text-text-3 font-mono mt-1.5">Processing (merging/converting)...</p>
          </div>
        )}

        {card.status === "completed" && (
          <div className="mt-1">
            <p className="text-sm text-ok">Saved as {card.fileName}</p>
            {card.destinationDir && <p className="text-xs text-text-3 font-mono">{card.destinationDir}</p>}
          </div>
        )}

        {card.status === "failed" && (
          <div className="mt-1">
            <p className="text-sm text-danger">{card.error}</p>
            <button onClick={onRetryDownload} className={`${LINK} mt-1`}>
              Retry
            </button>
          </div>
        )}

        {card.status === "cancelled" && (
          <div className="mt-1">
            <p className="text-sm text-text-3">Cancelled</p>
            <button onClick={onRetryDownload} className={`${LINK} mt-1`}>
              Retry
            </button>
          </div>
        )}

        {card.status === "paused" && (
          <div className="mt-1">
            <p className="text-sm text-text-2">Paused</p>
            <button onClick={onResume} className={`${LINK} mt-1`}>
              Resume
            </button>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 flex items-center gap-2">
        {card.status === "downloading" && (
          <>
            <button onClick={onPause} className={BTN_GHOST_SM}>
              Pause
            </button>
            <button onClick={onCancel} className={LINK_MUTED}>
              Cancel
            </button>
          </>
        )}
        {(card.status === "preparing" || card.status === "processing") && (
          <button onClick={onCancel} className={LINK_MUTED}>
            Cancel
          </button>
        )}
        {card.status === "queued" && (
          <button onClick={onCancel} className={LINK_MUTED}>
            Cancel
          </button>
        )}
        {card.status !== "downloading" &&
          card.status !== "preparing" &&
          card.status !== "processing" &&
          card.status !== "queued" && (
            <button onClick={onRemove} aria-label="Remove" className="text-sm text-text-3 hover:text-text transition-colors">
              ✕
            </button>
          )}
      </div>
    </div>
  );
}
