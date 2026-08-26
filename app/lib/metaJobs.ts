import { MetaAdManifest, MetaAdType, MetaCreativeKind, TranscriptFormat } from "@/app/lib/services/meta/types";
import { parseAdSnapshot } from "@/app/lib/services/meta/parseSnapshot";
import { metaCreativeFileName, metaTranscriptBaseName } from "@/app/lib/services/meta/naming";
import { YtDlpProgress } from "@/app/lib/services/downloader/ytdlpProgress";

export type MetaCreativeJobStatus =
  | "ready"
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type MetaTranscriptStatus = "idle" | "pending" | "processing" | "completed" | "failed";

export interface MetaCreativeJob {
  id: string;
  adArchiveId: string;
  index: number;
  kind: MetaCreativeKind;
  url: string;
  fileName: string;
  transcriptBaseName: string;
  status: MetaCreativeJobStatus;
  progress?: YtDlpProgress;
  filePath?: string;
  error?: string;
  transcriptStatus: MetaTranscriptStatus;
  transcriptError?: string;
}

export type MetaGroupStatus = "loading" | "resolve-error" | "ready";

export interface MetaAdGroup {
  id: string;
  url: string;
  adArchiveId?: string;
  pageName?: string;
  adType?: MetaAdType;
  status: MetaGroupStatus;
  error?: string;
  creatives: MetaCreativeJob[];
}

function newId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createMetaAdGroup(url: string): MetaAdGroup {
  return { id: newId("meta-ad"), url, status: "loading", creatives: [] };
}

function manifestToCreatives(manifest: MetaAdManifest): MetaCreativeJob[] {
  return manifest.creatives.map((c) => ({
    id: newId("meta-creative"),
    adArchiveId: manifest.adArchiveId,
    index: c.index,
    kind: c.kind,
    url: c.url,
    fileName: metaCreativeFileName(manifest, c),
    transcriptBaseName: metaTranscriptBaseName(manifest, c),
    status: "ready",
    transcriptStatus: "idle",
  }));
}

// window.desktop.resolveMetaAd only exists inside the Electron app (it needs
// a hidden BrowserWindow to get past Meta's bot-challenge, which has no web
// equivalent) -- callers should check that before calling this, but this
// also fails clearly rather than throwing a confusing TypeError if it's
// called from a plain browser tab anyway.
export async function resolveMetaAd(url: string): Promise<{
  adArchiveId: string;
  pageName?: string;
  adType: MetaAdType;
  creatives: MetaCreativeJob[];
}> {
  if (!window.desktop) {
    throw new Error("Meta Ads extraction requires the desktop app.");
  }
  const raw = await window.desktop.resolveMetaAd(url);
  const manifest = parseAdSnapshot(raw);
  if (manifest.creatives.length === 0) {
    throw new Error("No downloadable media was found for this ad.");
  }
  return {
    adArchiveId: manifest.adArchiveId,
    pageName: manifest.pageName,
    adType: manifest.adType,
    creatives: manifestToCreatives(manifest),
  };
}

export interface RunMetaCreativeJobResult {
  filePath: string;
  fileName: string;
}

export async function runMetaCreativeJob(
  creative: MetaCreativeJob,
  outputDir: string | undefined,
  signal: AbortSignal,
  onProgress: (patch: Partial<MetaCreativeJob>) => void
): Promise<RunMetaCreativeJobResult> {
  const res = await fetch("/api/meta-download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: creative.url,
      fileName: creative.fileName,
      adArchiveId: creative.adArchiveId,
      outputDir,
      jobId: creative.id,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(data.error || "Unable to download this creative.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: RunMetaCreativeJobResult | undefined;

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
        result?: RunMetaCreativeJobResult;
      };
      if (msg.error) throw new Error(msg.error);
      if (msg.result) result = msg.result;
      else if (msg.phase) onProgress({ progress: msg });
    }
  }

  if (!result) throw new Error("Unable to download this creative.");
  return result;
}

export async function runMetaTranscribeJob(
  creative: MetaCreativeJob,
  outputFormat: "original" | "hinglish",
  formats: TranscriptFormat[]
): Promise<void> {
  if (!creative.filePath) throw new Error("This creative hasn't been downloaded yet.");

  const res = await fetch("/api/meta-transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      videoPath: creative.filePath,
      transcriptBaseName: creative.transcriptBaseName,
      outputFormat,
      formats,
      jobId: creative.id,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Transcription failed.");
}

export function cancelMetaJobOnServer(jobId: string) {
  fetch("/api/job-cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId }),
    keepalive: true,
  }).catch(() => {});
}
