import { TranscriptSegment } from "@/app/types";
import { extractInstagramReelId } from "@/app/lib/instagram";
import { extractDailymotionVideoId } from "@/app/lib/dailymotion";

export type JobSource = "upload" | "youtube" | "instagram" | "dailymotion" | "google-drive";
export type JobStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";
export type OutputFormat = "original" | "hinglish";

export interface TranscriptionJob {
  id: string;
  fileName: string;
  source: JobSource;
  status: JobStatus;
  progress?: number;
  error?: string;
  transcript?: TranscriptSegment[];
  // Present only when a hinglish job's pre-conversion text happened to be
  // computed anyway — lets the reading view offer an Original/Hinglish
  // toggle without ever running a second conversion.
  originalTranscript?: TranscriptSegment[];

  // Fields needed to actually run (or retry) the job. Only the ones
  // relevant to `source` are populated.
  outputFormat: OutputFormat;
  file?: File; // upload
  url?: string; // youtube / instagram
  fileId?: string; // google-drive
  resourceKey?: string | null; // google-drive

  // Dailymotion has an extra download step before transcription even starts,
  // so its "processing" status carries richer, real backend-reported
  // progress (download %/bytes/speed/ETA, transcription elapsed time) the
  // UI can show instead of a single opaque "Processing...". Unused by every
  // other source.
  dailymotionProgress?: DailymotionProgress;
}

export interface DailymotionProgress {
  stage: "downloading" | "downloaded" | "transcribing";
  percent?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  speedBytesPerSec?: number;
  etaSeconds?: number;
  elapsedSeconds?: number;
}

function newJobId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `job-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createUploadJob(file: File, outputFormat: OutputFormat): TranscriptionJob {
  return {
    id: newJobId(),
    fileName: file.name,
    source: "upload",
    status: "pending",
    outputFormat,
    file,
  };
}

export function createYoutubeJob(url: string, outputFormat: OutputFormat): TranscriptionJob {
  let label = "YouTube Transcript";
  try {
    const parsed = new URL(url.trim());
    const id = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop();
    if (id) label = `YouTube - ${id}`;
  } catch {
    // keep default label
  }

  return {
    id: newJobId(),
    fileName: label,
    source: "youtube",
    status: "pending",
    outputFormat,
    url,
  };
}

export function createInstagramJob(url: string, outputFormat: OutputFormat): TranscriptionJob {
  const reelId = extractInstagramReelId(url);
  return {
    id: newJobId(),
    fileName: reelId ? `Instagram - ${reelId}` : "Instagram Transcript",
    source: "instagram",
    status: "pending",
    outputFormat,
    url,
  };
}

export function createDailymotionJob(url: string, outputFormat: OutputFormat): TranscriptionJob {
  const videoId = extractDailymotionVideoId(url);
  return {
    id: newJobId(),
    fileName: videoId ? `Dailymotion - ${videoId}` : "Dailymotion Transcript",
    source: "dailymotion",
    status: "pending",
    outputFormat,
    url,
  };
}

export function createGoogleDriveJob(
  file: { id: string; name: string },
  resourceKey: string | null,
  outputFormat: OutputFormat
): TranscriptionJob {
  return {
    id: newJobId(),
    fileName: file.name,
    source: "google-drive",
    status: "pending",
    outputFormat,
    fileId: file.id,
    resourceKey,
  };
}

export interface RunJobResult {
  transcript: TranscriptSegment[];
  originalTranscript?: TranscriptSegment[];
}

// The single shared dispatch function every job runs through, regardless of
// source — this is the one place that talks to the existing per-source API
// routes, so there is exactly one worker implementation for the whole queue.
export async function runJob(
  job: TranscriptionJob,
  signal: AbortSignal,
  onProgress?: (patch: Partial<TranscriptionJob>) => void
): Promise<RunJobResult> {
  switch (job.source) {
    case "upload": {
      if (!job.file) throw new Error("Missing file for upload job.");
      const formData = new FormData();
      formData.append("file", job.file);
      formData.append("outputFormat", job.outputFormat);
      formData.append("jobId", job.id);

      const res = await fetch("/api/transcribe", { method: "POST", body: formData, signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transcription failed. Please try again.");
      return { transcript: data.segments, originalTranscript: data.originalSegments };
    }

    case "youtube": {
      if (!job.url) throw new Error("Missing URL for YouTube job.");
      const res = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: job.url, jobId: job.id }),
        signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch transcript.");
      return { transcript: data.segments };
    }

    case "instagram": {
      if (!job.url) throw new Error("Missing URL for Instagram job.");
      const res = await fetch("/api/instagram-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: job.url, outputFormat: job.outputFormat, jobId: job.id }),
        signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not retrieve the Reel.");
      return { transcript: data.segments, originalTranscript: data.originalSegments };
    }

    case "dailymotion": {
      if (!job.url) throw new Error("Missing URL for Dailymotion job.");
      const res = await fetch("/api/dailymotion-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: job.url, outputFormat: job.outputFormat, jobId: job.id }),
        signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(data.error || "Unable to fetch this Dailymotion video.");
      }
      if (!res.body) throw new Error("Unable to fetch this Dailymotion video.");

      onProgress?.({ dailymotionProgress: { stage: "downloading" } });

      // The route streams newline-delimited JSON phase events so the UI can
      // show real download progress (%, bytes, speed, ETA) and transcription
      // elapsed time instead of one opaque "Processing..." for Dailymotion's
      // extra download step.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result: { segments: TranscriptSegment[]; originalSegments?: TranscriptSegment[] } | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (!line.trim()) continue;

          const msg = JSON.parse(line) as {
            phase?: "downloading" | "downloaded" | "transcribing";
            percent?: number;
            downloadedBytes?: number;
            totalBytes?: number;
            speedBytesPerSec?: number;
            etaSeconds?: number;
            elapsedSeconds?: number;
            error?: string;
            result?: { segments: TranscriptSegment[]; originalSegments?: TranscriptSegment[] };
          };
          if (msg.phase) {
            onProgress?.({
              dailymotionProgress: {
                stage: msg.phase,
                percent: msg.percent,
                downloadedBytes: msg.downloadedBytes,
                totalBytes: msg.totalBytes,
                speedBytesPerSec: msg.speedBytesPerSec,
                etaSeconds: msg.etaSeconds,
                elapsedSeconds: msg.elapsedSeconds,
              },
            });
          } else if (msg.error) throw new Error(msg.error);
          else if (msg.result) result = msg.result;
        }
      }

      if (!result) throw new Error("Unable to fetch this Dailymotion video.");
      return { transcript: result.segments, originalTranscript: result.originalSegments };
    }

    case "google-drive": {
      if (!job.fileId) throw new Error("Missing Google Drive file ID.");
      const res = await fetch("/api/drive-transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: job.fileId,
          resourceKey: job.resourceKey ?? null,
          fileName: job.fileName,
          outputFormat: job.outputFormat,
          jobId: job.id,
        }),
        signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${job.fileName} could not be transcribed.`);
      return { transcript: data.segments, originalTranscript: data.originalSegments };
    }
  }
}

export function cancelJobOnServer(jobId: string) {
  fetch("/api/job-cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId }),
    keepalive: true,
  }).catch(() => {});
}
