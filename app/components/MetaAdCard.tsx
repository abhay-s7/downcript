"use client";

import { MetaAdGroup, MetaCreativeJob } from "@/app/lib/metaJobs";

function CreativeRow({
  group,
  creative,
  onDownload,
  onCancel,
  onGenerateTranscript,
}: {
  group: MetaAdGroup;
  creative: MetaCreativeJob;
  onDownload: () => void;
  onCancel: () => void;
  onGenerateTranscript: () => void;
}) {
  const label = group.creatives.length > 1 ? `Creative ${String(creative.index).padStart(2, "0")}` : null;

  return (
    <div className="flex items-center gap-3 py-2.5 border-t border-gray-100">
      <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded px-1.5 py-0.5 w-14 text-center flex-shrink-0">
        {creative.kind === "video" ? "Video" : "Image"}
      </span>
      {label && <span className="text-sm text-gray-400 flex-shrink-0">{label}</span>}
      <span className="text-sm text-gray-700 truncate flex-1">{creative.fileName}</span>

      <div className="flex items-center gap-2 flex-shrink-0">
        {creative.status === "ready" && (
          <button onClick={onDownload} className="text-sm text-blue-600 hover:underline">
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
        {creative.status === "completed" && (
          <>
            <span className="text-sm text-green-600">✓ Saved</span>
            {creative.kind === "video" && creative.transcriptStatus === "idle" && (
              <button onClick={onGenerateTranscript} className="text-sm text-blue-600 hover:underline">
                Generate Transcript
              </button>
            )}
            {creative.kind === "video" && creative.transcriptStatus === "processing" && (
              <span className="text-sm text-gray-400">Transcribing...</span>
            )}
            {creative.kind === "video" && creative.transcriptStatus === "completed" && (
              <span className="text-sm text-green-600">✓ Transcribed</span>
            )}
            {creative.kind === "video" && creative.transcriptStatus === "failed" && (
              <span className="text-sm text-red-600" title={creative.transcriptError}>
                Transcript failed
              </span>
            )}
          </>
        )}
        {creative.status === "failed" && (
          <>
            <span className="text-sm text-red-600" title={creative.error}>
              Failed
            </span>
            <button onClick={onDownload} className="text-sm text-blue-600 hover:underline">
              Retry
            </button>
          </>
        )}
        {creative.status === "cancelled" && (
          <button onClick={onDownload} className="text-sm text-blue-600 hover:underline">
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export default function MetaAdCard({
  group,
  onDownloadCreative,
  onDownloadAll,
  onCancelCreative,
  onGenerateTranscript,
  onRemove,
}: {
  group: MetaAdGroup;
  onDownloadCreative: (creativeId: string) => void;
  onDownloadAll: () => void;
  onCancelCreative: (creativeId: string) => void;
  onGenerateTranscript: (creativeId: string) => void;
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
            <button onClick={onDownloadAll} className="text-sm text-blue-600 hover:underline">
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
            onDownload={() => onDownloadCreative(creative.id)}
            onCancel={() => onCancelCreative(creative.id)}
            onGenerateTranscript={() => onGenerateTranscript(creative.id)}
          />
        ))}
    </div>
  );
}
