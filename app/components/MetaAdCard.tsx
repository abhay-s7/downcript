"use client";

import { MetaAdGroup, MetaCreativeJob } from "@/app/lib/metaJobs";
import { CARD, CHIP, BTN_PRIMARY_SM, BTN_GHOST_SM, LINK_MUTED } from "@/app/lib/uiStyles";

function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

function CreativeRow({
  group,
  creative,
  transcriptFormatsSelected,
  onDownload,
  onCancel,
  onTranscriptOnly,
  onDownloadAndTranscript,
}: {
  group: MetaAdGroup;
  creative: MetaCreativeJob;
  transcriptFormatsSelected: boolean;
  onDownload: () => void;
  onCancel: () => void;
  onTranscriptOnly: () => void;
  onDownloadAndTranscript: () => void;
}) {
  const label = group.creatives.length > 1 ? `Creative ${String(creative.index).padStart(2, "0")}` : null;
  const formatHint = transcriptFormatsSelected ? undefined : "Select at least one transcript format above";

  // A video creative's three actions stay available together whenever
  // nothing is actively running for it -- rather than the button set
  // changing shape as status/transcriptStatus progress -- with completion
  // shown as a badge alongside them instead of replacing them, so e.g.
  // "Transcript Only" after an already-completed download still works
  // (it reuses the kept file; see runMetaTranscribeJob).
  const showVideoActions =
    creative.kind === "video" &&
    creative.status !== "pending" &&
    creative.status !== "processing" &&
    creative.transcriptStatus !== "processing";

  return (
    <div className="py-2.5 border-t border-line">
      <div className="flex items-center gap-3">
        <span className={`${CHIP} w-14 justify-center flex-shrink-0`}>{creative.kind === "video" ? "Video" : "Image"}</span>
        {creative.kind === "image" && (
          // eslint-disable-next-line @next/next/no-img-element -- direct Meta CDN URL, not a local/optimizable asset
          <img
            src={creative.url}
            alt=""
            referrerPolicy="no-referrer"
            className="h-9 w-9 rounded-[8px] object-cover flex-shrink-0 bg-surface-3"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
        {label && <span className="text-sm text-text-3 flex-shrink-0">{label}</span>}
        <span className="text-sm text-text-2 truncate flex-1">{creative.fileName}</span>

        <div className="flex items-center gap-2 flex-shrink-0">
          {creative.status === "completed" && <span className="text-sm text-ok">✓ Saved</span>}
          {creative.transcriptStatus === "completed" && (
            <span className="text-sm text-ok">✓ Transcribed</span>
          )}
          {creative.transcriptStatus === "processing" && (
            <span className="text-sm text-text-3">Transcribing...</span>
          )}
          {creative.transcriptStatus === "failed" && (
            <span className="text-sm text-danger" title={creative.transcriptError}>
              Transcript failed
            </span>
          )}

          {creative.kind === "image" && creative.status === "ready" && (
            <button onClick={onDownload} className={BTN_PRIMARY_SM}>
              Download Image
            </button>
          )}
          {creative.status === "pending" && <span className="text-sm text-text-3">Queued...</span>}
          {creative.status === "processing" && (
            <span className="text-sm text-text-2">
              {Math.floor(creative.progress?.percent ?? 0)}%
              {creative.progress?.downloadedBytes && creative.progress?.totalBytes
                ? ` (${formatBytes(creative.progress.downloadedBytes)} / ${formatBytes(creative.progress.totalBytes)})`
                : ""}
              <button onClick={onCancel} className="ml-2 text-text-3 hover:text-text transition-colors">
                Cancel
              </button>
            </span>
          )}
          {creative.status === "failed" && (
            <>
              <span className="text-sm text-danger" title={creative.error}>
                Failed
              </span>
              <button onClick={onDownload} className={BTN_GHOST_SM}>
                Retry
              </button>
            </>
          )}
          {creative.status === "cancelled" && (
            <>
              <span className="text-sm text-text-3">Cancelled</span>
              <button onClick={onDownload} className={BTN_GHOST_SM}>
                Retry
              </button>
            </>
          )}
        </div>
      </div>

      {showVideoActions && (
        <div className="flex flex-wrap gap-2 mt-2.5 pl-[68px]">
          <button onClick={onDownload} className={BTN_GHOST_SM}>
            Download Video
          </button>
          <button onClick={onTranscriptOnly} disabled={!transcriptFormatsSelected} title={formatHint} className={BTN_GHOST_SM}>
            Transcript Only
          </button>
          <button onClick={onDownloadAndTranscript} disabled={!transcriptFormatsSelected} title={formatHint} className={BTN_PRIMARY_SM}>
            Download Video + Transcript
          </button>
        </div>
      )}
    </div>
  );
}

export default function MetaAdCard({
  group,
  transcriptFormatsSelected,
  onDownloadCreative,
  onDownloadAll,
  onCancelCreative,
  onTranscriptOnly,
  onDownloadAndTranscript,
  onRemove,
}: {
  group: MetaAdGroup;
  transcriptFormatsSelected: boolean;
  onDownloadCreative: (creativeId: string) => void;
  onDownloadAll: () => void;
  onCancelCreative: (creativeId: string) => void;
  onTranscriptOnly: (creativeId: string) => void;
  onDownloadAndTranscript: (creativeId: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {group.status === "ready" && (
            <span className={CHIP}>{group.adType === "carousel" ? "Carousel" : group.adType === "video" ? "Video" : "Image"}</span>
          )}
          <span className="text-sm font-medium text-text truncate">
            {group.status === "ready" ? `${group.pageName || "Meta Ad"} — #${group.adArchiveId}` : group.url}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {group.status === "ready" && group.creatives.length > 1 && (
            <button onClick={onDownloadAll} className={BTN_GHOST_SM}>
              Download All
            </button>
          )}
          <button onClick={onRemove} aria-label="Remove" className={LINK_MUTED}>
            ✕
          </button>
        </div>
      </div>

      {group.status === "loading" && <p className="text-sm text-text-3 mt-2">Analyzing ad...</p>}

      {group.status === "resolve-error" && <p className="text-sm text-danger mt-2">{group.error}</p>}

      {group.status === "ready" &&
        group.creatives.map((creative) => (
          <CreativeRow
            key={creative.id}
            group={group}
            creative={creative}
            transcriptFormatsSelected={transcriptFormatsSelected}
            onDownload={() => onDownloadCreative(creative.id)}
            onCancel={() => onCancelCreative(creative.id)}
            onTranscriptOnly={() => onTranscriptOnly(creative.id)}
            onDownloadAndTranscript={() => onDownloadAndTranscript(creative.id)}
          />
        ))}
    </div>
  );
}
