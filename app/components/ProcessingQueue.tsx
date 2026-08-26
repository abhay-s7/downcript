"use client";

import { DailymotionProgress, TranscriptionJob } from "@/app/lib/jobs";

const STATUS_META: Record<
  TranscriptionJob["status"],
  { icon: string; color: string; label: string }
> = {
  completed: { icon: "✓", color: "text-green-600", label: "Completed" },
  processing: { icon: "●", color: "text-blue-600", label: "Processing" },
  pending: { icon: "○", color: "text-gray-400", label: "Waiting" },
  failed: { icon: "⚠", color: "text-amber-600", label: "Failed" },
  cancelled: { icon: "—", color: "text-gray-400", label: "Cancelled" },
};

function formatBytes(bytes?: number): string | undefined {
  if (bytes === undefined) return undefined;
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function formatSpeed(bytesPerSec?: number): string | undefined {
  const size = formatBytes(bytesPerSec);
  return size ? `${size}/s` : undefined;
}

function formatDuration(seconds?: number): string | undefined {
  if (seconds === undefined) return undefined;
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total} sec`;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

// Every source but Dailymotion has one "processing" state, so the generic
// STATUS_META label is fine. Dailymotion adds a download step in front of
// transcription, so it gets a phase-specific label instead of a single
// opaque "Processing...".
function statusLabel(job: TranscriptionJob): string {
  if (job.status === "processing" && job.source === "dailymotion") {
    const progress = job.dailymotionProgress;
    switch (progress?.stage) {
      case "downloaded":
        return "Downloaded — starting transcription...";
      case "transcribing":
        return "Transcribing...";
      case "downloading":
      default:
        return progress?.percent !== undefined
          ? `Downloading... ${Math.floor(progress.percent)}%`
          : "Downloading...";
    }
  }
  return STATUS_META[job.status].label;
}

// Real, backend-reported progress only — no simulated/timer-based bars.
// Download stage shows a percentage bar plus size/speed/ETA when yt-dlp
// reports them; transcription has no reliable percentage available (Whisper
// exposes no progress callback here), so it shows elapsed time instead.
function DailymotionProgressDetail({ progress }: { progress: DailymotionProgress }) {
  if (progress.stage === "downloaded") {
    return <p className="text-xs text-green-600">✓ Download complete</p>;
  }

  if (progress.stage === "transcribing") {
    const elapsed = formatDuration(progress.elapsedSeconds);
    return (
      <div className="space-y-0.5">
        <p className="text-xs text-gray-500">Processing audio...</p>
        {elapsed && <p className="text-xs text-gray-400">Elapsed: {elapsed}</p>}
      </div>
    );
  }

  const downloaded = formatBytes(progress.downloadedBytes);
  const total = formatBytes(progress.totalBytes);
  const sizeLabel = downloaded && total ? `${downloaded} / ${total}` : downloaded ? `Downloaded: ${downloaded}` : undefined;
  const speed = formatSpeed(progress.speedBytesPerSec);
  const eta = formatDuration(progress.etaSeconds);

  return (
    <div className="space-y-1">
      {progress.percent !== undefined && (
        <div className="h-1.5 w-full max-w-xs rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-600"
            style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
          />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 text-xs text-gray-500">
        {sizeLabel && <span>{sizeLabel}</span>}
        {speed && <span>{speed}</span>}
        {eta && <span>ETA: {eta}</span>}
      </div>
    </div>
  );
}

export default function ProcessingQueue({
  jobs,
  isProcessing,
  onCancel,
  onResume,
  onRetryFailed,
  onRetryJob,
}: {
  jobs: TranscriptionJob[];
  isProcessing: boolean;
  onCancel: () => void;
  onResume: () => void;
  onRetryFailed: () => void;
  onRetryJob: (id: string) => void;
}) {
  const currentJob = jobs.find((j) => j.status === "processing");
  const settledCount = jobs.filter(
    (j) => j.status !== "pending" && j.status !== "processing"
  ).length;
  const hasCancelled = jobs.some((j) => j.status === "cancelled");
  const hasFailed = jobs.some((j) => j.status === "failed");
  const hasPending = jobs.some((j) => j.status === "pending");

  const counts = {
    completed: jobs.filter((j) => j.status === "completed").length,
    failed: jobs.filter((j) => j.status === "failed").length,
    cancelled: jobs.filter((j) => j.status === "cancelled").length,
    waiting: jobs.filter((j) => j.status === "pending").length,
  };
  const summary = [
    counts.completed > 0 && `${counts.completed} completed`,
    counts.failed > 0 && `${counts.failed} failed`,
    counts.cancelled > 0 && `${counts.cancelled} cancelled`,
    counts.waiting > 0 && `${counts.waiting} waiting`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <p className="font-medium text-gray-900">
            {currentJob
              ? currentJob.source === "dailymotion"
                ? statusLabel(currentJob)
                : "Transcribing"
              : hasCancelled
              ? "Processing paused"
              : "Processing"}
          </p>
          <p className="text-sm text-gray-500">
            {currentJob
              ? `${Math.min(settledCount + 1, jobs.length)} of ${jobs.length} video${
                  jobs.length === 1 ? "" : "s"
                }`
              : summary}
          </p>
        </div>
        <div className="flex gap-2">
          {(isProcessing || hasPending) && (
            <button
              onClick={onCancel}
              className="text-sm font-medium px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            >
              Cancel Processing
            </button>
          )}
          {!isProcessing && hasCancelled && (
            <button
              onClick={onResume}
              className="text-sm font-medium px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Resume
            </button>
          )}
          {hasFailed && (
            <button
              onClick={onRetryFailed}
              className="text-sm font-medium px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Retry Failed
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-gray-100 divide-y divide-gray-100">
        {jobs.map((job) => {
          const meta = STATUS_META[job.status];
          return (
            <div key={job.id} className="px-5 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className={`${meta.color} font-medium w-4 text-center`}>{meta.icon}</span>
                <span className="text-sm text-gray-900 truncate flex-1">{job.fileName}</span>
                <span className={`text-xs font-medium ${meta.color}`}>{statusLabel(job)}</span>
              </div>
              {job.status === "failed" && (
                <div className="pl-[26px] mt-1 flex items-center gap-3">
                  <p className="text-sm text-gray-500">{job.error}</p>
                  <button
                    onClick={() => onRetryJob(job.id)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    Retry
                  </button>
                </div>
              )}
              {job.status === "processing" && job.source === "dailymotion" && job.dailymotionProgress && (
                <div className="pl-[26px] mt-1.5">
                  <DailymotionProgressDetail progress={job.dailymotionProgress} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
