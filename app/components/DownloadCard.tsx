"use client";

import { DownloadCard as DownloadCardModel, DownloadFormatSelection } from "@/app/lib/downloadJobs";

const SECONDARY_BUTTON =
  "text-sm text-gray-600 border border-gray-300 rounded-md px-3 py-1 hover:bg-gray-50 hover:border-gray-400 transition-colors";

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
    <div className="rounded-lg border border-gray-200 bg-white p-4 flex gap-4">
      {card.thumbnail ? (
        <img src={card.thumbnail} alt="" className="w-28 h-16 object-cover rounded-md flex-shrink-0" />
      ) : (
        <div className="w-28 h-16 rounded-md bg-gray-100 flex-shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
            {card.platform}
          </span>
          {card.duration ? (
            <span className="text-xs text-gray-400">{formatDuration(card.duration)}</span>
          ) : null}
        </div>

        <p className="text-sm font-medium text-gray-900 truncate">{card.title || card.url}</p>

        {card.status === "loading" && <p className="text-sm text-gray-400 mt-1">Analyzing...</p>}

        {card.status === "info-error" && (
          <div className="mt-1">
            <p className="text-sm text-red-600">{card.error}</p>
            <button onClick={onRetryInfo} className="text-sm text-blue-600 hover:underline mt-1">
              Retry
            </button>
          </div>
        )}

        {card.status === "ready" && (
          <div className="mt-2 flex items-center gap-2">
            <select
              value={selectedValue}
              onChange={(e) => {
                const v = e.target.value;
                onSetFormat(v === "audio" ? "audio" : v === "best" ? "best" : { height: Number(v) });
              }}
              className="rounded-md border border-gray-300 text-sm px-2 py-1.5"
            >
              <option value="best">Best video quality</option>
              {card.formats?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
              <option value="audio">Audio only (MP3)</option>
            </select>
            <button
              onClick={onStartDownload}
              className="rounded-md bg-blue-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Download
            </button>
          </div>
        )}

        {card.status === "queued" && <p className="text-sm text-gray-400 mt-1">Queued...</p>}

        {card.status === "preparing" && <p className="text-sm text-gray-400 mt-1">Preparing...</p>}

        {card.status === "downloading" && (
          <div className="mt-2">
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${Math.min(99, card.progress?.percent ?? 0)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {Math.floor(card.progress?.percent ?? 0)}%
              {card.progress?.speedBytesPerSec ? ` · ${formatBytes(card.progress.speedBytesPerSec)}/s` : ""}
              {card.progress?.downloadedBytes && card.progress?.totalBytes
                ? ` · ${formatBytes(card.progress.downloadedBytes)} / ${formatBytes(card.progress.totalBytes)}`
                : ""}
            </p>
          </div>
        )}

        {card.status === "processing" && (
          <div className="mt-2">
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full bg-blue-600 animate-pulse" style={{ width: "100%" }} />
            </div>
            <p className="text-xs text-gray-400 mt-1">Processing (merging/converting)...</p>
          </div>
        )}

        {card.status === "completed" && (
          <div className="mt-1">
            <p className="text-sm text-green-600">Saved as {card.fileName}</p>
            {card.destinationDir && <p className="text-xs text-gray-400">{card.destinationDir}</p>}
          </div>
        )}

        {card.status === "failed" && (
          <div className="mt-1">
            <p className="text-sm text-red-600">{card.error}</p>
            <button onClick={onRetryDownload} className="text-sm text-blue-600 hover:underline mt-1">
              Retry
            </button>
          </div>
        )}

        {card.status === "cancelled" && (
          <div className="mt-1">
            <p className="text-sm text-gray-400">Cancelled</p>
            <button onClick={onRetryDownload} className="text-sm text-blue-600 hover:underline mt-1">
              Retry
            </button>
          </div>
        )}

        {card.status === "paused" && (
          <div className="mt-1">
            <p className="text-sm text-gray-500">Paused</p>
            <button onClick={onResume} className="text-sm text-blue-600 hover:underline mt-1">
              Resume
            </button>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 flex items-center gap-2">
        {card.status === "downloading" && (
          <>
            <button onClick={onPause} className={SECONDARY_BUTTON}>
              Pause
            </button>
            <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-900">
              Cancel
            </button>
          </>
        )}
        {(card.status === "preparing" || card.status === "processing") && (
          <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-900">
            Cancel
          </button>
        )}
        {card.status === "queued" && (
          <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-900">
            Cancel
          </button>
        )}
        {card.status !== "downloading" &&
          card.status !== "preparing" &&
          card.status !== "processing" &&
          card.status !== "queued" && (
            <button onClick={onRemove} aria-label="Remove" className="text-sm text-gray-400 hover:text-gray-700">
              ✕
            </button>
          )}
      </div>
    </div>
  );
}
