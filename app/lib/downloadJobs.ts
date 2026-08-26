import { MediaFormat } from "@/app/lib/services/downloader/types";
import { YtDlpProgress } from "@/app/lib/services/downloader/ytdlpProgress";
import { detectPlatform } from "@/app/lib/services/downloader/platformDetection";

export type DownloadFormatSelection = "audio" | "best" | { height: number };

// "loading"/"info-error"/"ready" happen before a card ever enters the
// download queue (mirrors Downly's analyze-then-pick-quality step); once the
// user starts the actual download it moves through the same
// pending/processing/completed/failed/cancelled vocabulary the transcription
// queue uses, so one worker loop shape covers both.
export type DownloadCardStatus =
  | "loading"
  | "info-error"
  | "ready"
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface DownloadCard {
  id: string;
  url: string;
  platform: string;
  status: DownloadCardStatus;
  title?: string;
  thumbnail?: string;
  duration?: number;
  formats?: MediaFormat[];
  selectedFormat: DownloadFormatSelection;
  progress?: YtDlpProgress;
  fileName?: string;
  filePath?: string;
  error?: string;
}

function newCardId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `download-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createDownloadCard(url: string): DownloadCard {
  return {
    id: newCardId(),
    url,
    platform: detectPlatform(url),
    status: "loading",
    selectedFormat: "best",
  };
}

export async function fetchMediaInfoForCard(
  url: string
): Promise<{ title: string; thumbnail?: string; duration?: number; formats: MediaFormat[] }> {
  const res = await fetch("/api/download-info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Unable to process this URL.");
  return data;
}

export interface RunDownloadJobResult {
  filePath: string;
  fileName: string;
}

// The one dispatch function every queued download runs through — reads the
// ndjson stream from /api/download the same way jobs.ts's runJob does for
// Dailymotion transcription, so progress lands on the card in real time.
export async function runDownloadJob(
  card: DownloadCard,
  outputDir: string | undefined,
  signal: AbortSignal,
  onProgress: (patch: Partial<DownloadCard>) => void
): Promise<RunDownloadJobResult> {
  const res = await fetch("/api/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: card.url,
      title: card.title || card.platform,
      jobId: card.id,
      outputDir,
      format: card.selectedFormat === "audio" ? "audio" : card.selectedFormat === "best" ? "best" : "height",
      height: typeof card.selectedFormat === "object" ? card.selectedFormat.height : undefined,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(data.error || "Unable to download this URL.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: RunDownloadJobResult | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex;
    while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (!line.trim()) continue;

      const msg = JSON.parse(line) as YtDlpProgress & {
        phase?: string;
        error?: string;
        result?: RunDownloadJobResult;
      };
      if (msg.error) throw new Error(msg.error);
      if (msg.result) result = msg.result;
      else if (msg.phase) onProgress({ progress: msg });
    }
  }

  if (!result) throw new Error("Unable to download this URL.");
  return result;
}

export function cancelDownloadJobOnServer(jobId: string) {
  fetch("/api/job-cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId }),
    keepalive: true,
  }).catch(() => {});
}
