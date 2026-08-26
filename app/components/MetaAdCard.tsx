"use client";

import { MetaAdGroup, MetaCreativeJob } from "@/app/lib/metaJobs";

const BUTTON_BASE =
  "inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-medium transition-colors whitespace-nowrap";
const PRIMARY_BUTTON = `${BUTTON_BASE} bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed`;
const SECONDARY_BUTTON = `${BUTTON_BASE} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:bg-white disabled:border-gray-200 disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-200`;

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
    <div className="py-2.5 border-t border-gray-100">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded px-1.5 py-0.5 w-14 text-center flex-shrink-0">
          {creative.kind === "video" ? "Video" : "Image"}
        </span>
        {label && <span className="text-sm text-gray-400 flex-shrink-0">{label}</span>}
        <span className="text-sm text-gray-700 truncate flex-1">{creative.fileName}</span>

        <div className="flex items-center gap-2 flex-shrink-0">
          {creative.status === "completed" && <span className="text-sm text-green-600">✓ Saved</span>}
          {creative.transcriptStatus === "completed" && (
            <span className="text-sm text-green-600">✓ Transcribed</span>
          )}
          {creative.transcriptStatus === "processing" && (
            <span className="text-sm text-gray-400">Transcribing...</span>
          )}
          {creative.transcriptStatus === "failed" && (
            <span className="text-sm text-red-600" title={creative.transcriptError}>
              Transcript failed
            </span>
          )}

          {creative.kind === "image" && creative.status === "ready" && (
            <button onClick={onDownload} className={PRIMARY_BUTTON}>
              Download
            </button>
          )}
          {creative.status === "pending" && <span className="text-sm text-gray-400">Queued...</span>}
          {creative.status === "processing" && (
            <span className="text-sm text-gray-500">
              {Math.floor(creative.progress?.percent ?? 0)}%
              <button onClick={onCancel} className="ml-2 text-gray-400 hover:text-gray-700">
                Cancel
              </button>
            </span>
          )}
          {creative.status === "failed" && (
            <>
              <span className="text-sm text-red-600" title={creative.error}>
                Failed
              </span>
              <button onClick={onDownload} className={SECONDARY_BUTTON}>
                Retry
              </button>
            </>
          )}
          {creative.status === "cancelled" && (
            <button onClick={onDownload} className={SECONDARY_BUTTON}>
              Retry
            </button>
          )}
        </div>
      </div>

      {showVideoActions && (
        <div className="flex flex-wrap gap-2 mt-2.5 pl-[68px]">
          <button onClick={onDownload} className={SECONDARY_BUTTON}>
            Download Video
          </button>
          <button
            onClick={onTranscriptOnly}
            disabled={!transcriptFormatsSelected}
            title={formatHint}
            className={SECONDARY_BUTTON}
          >
            Transcript Only
          </button>
          <button
            onClick={onDownloadAndTranscript}
            disabled={!transcriptFormatsSelected}
            title={formatHint}
            className={PRIMARY_BUTTON}
          >
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
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {group.status === "ready" && (
            <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
              {group.adType === "carousel" ? "Carousel" : group.adType === "video" ? "Video" : "Image"}
            </span>
          )}
          <span className="text-sm font-medium text-gray-900 truncate">
            {group.status === "ready" ? `${group.pageName || "Meta Ad"} — #${group.adArchiveId}` : group.url}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {group.status === "ready" && group.creatives.length > 1 && (
            <button onClick={onDownloadAll} className={SECONDARY_BUTTON}>
              Download All
            </button>
          )}
          <button onClick={onRemove} aria-label="Remove" className="text-sm text-gray-400 hover:text-gray-700">
            ✕
          </button>
        </div>
      </div>

      {group.status === "loading" && <p className="text-sm text-gray-400 mt-2">Analyzing ad...</p>}

      {group.status === "resolve-error" && <p className="text-sm text-red-600 mt-2">{group.error}</p>}

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
