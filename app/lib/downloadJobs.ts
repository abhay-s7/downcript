import { MediaFormat } from "@/app/lib/services/downloader/types";
import { YtDlpProgress } from "@/app/lib/services/downloader/ytdlpProgress";
import { detectPlatform } from "@/app/lib/services/downloader/platformDetection";

export type DownloadFormatSelection = "audio" | "best" | { height: number };

// "loading"/"info-error"/"ready" happen before a card ever enters the
// download queue (mirrors Downly's analyze-then-pick-quality step). Once the
// user starts the actual download it moves through queued -> preparing ->
// downloading -> (processing, if yt-dlp needs to mux/extract locally after
// the transfer) -> completed, or failed/cancelled/paused off that path.
export type DownloadCardStatus =
  | "loading"
  | "info-error"
  | "ready"
  | "queued"
  | "preparing"
  | "downloading"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused";

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
  // Snapshot of the folder this job is (or was) downloading into, taken the
  // moment the job starts -- so a job started before a later Settings folder
  // change still displays (and, on resume/retry, targets) the folder it
  // actually used, rather than silently following a change made afterward.
  destinationDir?: string;
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
        phase?: "preparing" | "downloading" | "processing";
        destinationDir?: string;
        error?: string;
        result?: RunDownloadJobResult;
      };
      if (msg.error) throw new Error(msg.error);
      if (msg.result) {
        result = msg.result;
        continue;
      }
      if (msg.phase === "preparing") {
        onProgress({ status: "preparing", destinationDir: msg.destinationDir });
      } else if (msg.phase === "downloading") {
        onProgress({ status: "downloading", progress: msg });
      } else if (msg.phase === "processing") {
        onProgress({ status: "processing" });
      }
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

const QUEUE_STORAGE_KEY = "downcript:downloadQueue";

// Only metadata survives a reload -- live progress/speed is meaningless once
// the process that produced it is gone, and a card still mid-analyze
// ("loading") has nothing worth restoring. Anything that was actively
// running at save-time is normalized to "paused": the underlying yt-dlp
// process died with the app, but buildDestinationPath() is deterministic
// from (outputDir, title, format), so Resume recomputes the same path and
// picks up any partial file yt-dlp left behind, same as a live pause/resume.
export function saveDownloadQueue(cards: DownloadCard[]): void {
  try {
    const persisted = cards
      .filter((c) => c.status !== "loading")
      .map((c) => ({
        ...c,
        progress: undefined,
        status: (["preparing", "downloading", "processing"] as DownloadCardStatus[]).includes(c.status)
          ? "paused"
          : c.status,
      }));
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // Storage unavailable/full -- the queue just won't survive a reload this session.
  }
}

export function loadDownloadQueue(): DownloadCard[] {
  try {
    const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as DownloadCard[]) : [];
  } catch {
    return [];
  }
}
