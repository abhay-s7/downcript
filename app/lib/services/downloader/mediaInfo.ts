import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveYtDlp } from "@/app/lib/ytdlpRuntime";
import { MediaFormat, MediaInfo } from "@/app/lib/services/downloader/types";

const execFileAsync = promisify(execFile);

export type { MediaFormat, MediaInfo };

interface YtDlpFormat {
  format_id: string;
  height?: number;
  vcodec?: string;
  ext?: string;
}

interface YtDlpInfoJson {
  title?: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  formats?: YtDlpFormat[];
}

export class MediaInfoUnavailableError extends Error {}

// One video-quality option per distinct height, highest first — mirrors
// Downly's "-S vcodec:h264,res:<height>" download-time selector (see
// runDownload below), so the option the user sees is the option that will
// actually be requested.
function summarizeFormats(raw: YtDlpFormat[] | undefined): MediaFormat[] {
  if (!raw) return [];

  const heights = new Set<number>();
  for (const f of raw) {
    if (f.vcodec && f.vcodec !== "none" && typeof f.height === "number") {
      heights.add(f.height);
    }
  }

  return Array.from(heights)
    .sort((a, b) => b - a)
    .map((height) => ({ id: String(height), label: `${height}p`, height }));
}

// yt-dlp -j <url> — metadata only, no download. 60s timeout matches Downly's
// original (a stuck info fetch shouldn't hang the "Analyze" step forever).
export async function fetchMediaInfo(url: string): Promise<MediaInfo> {
  const ytDlpPath = resolveYtDlp();

  let stdout: string;
  try {
    const result = await execFileAsync(
      ytDlpPath,
      ["--no-playlist", "-j", url.trim()],
      { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 }
    );
    stdout = result.stdout;
  } catch (err) {
    const stderr = err && typeof err === "object" && "stderr" in err ? String(err.stderr) : "";
    throw new MediaInfoUnavailableError(stderr.trim() || "Could not fetch information for this URL.");
  }

  let data: YtDlpInfoJson;
  try {
    data = JSON.parse(stdout);
  } catch {
    throw new MediaInfoUnavailableError("Unexpected response while analyzing this URL.");
  }

  return {
    title: data.title || "Untitled",
    thumbnail: data.thumbnail,
    duration: data.duration,
    uploader: data.uploader,
    formats: summarizeFormats(data.formats),
  };
}

// A URL containing list= is a YouTube playlist — expand it to individual
// video URLs before per-video info fetches, same as Downly.
export async function expandPlaylist(url: string): Promise<string[]> {
  const ytDlpPath = resolveYtDlp();

  try {
    const { stdout } = await execFileAsync(
      ytDlpPath,
      ["--flat-playlist", "-J", url.trim()],
      { timeout: 60_000, maxBuffer: 20 * 1024 * 1024 }
    );
    const data = JSON.parse(stdout) as { entries?: Array<{ url?: string; id?: string }> };
    return (data.entries || [])
      .map((e) => e.url || (e.id ? `https://www.youtube.com/watch?v=${e.id}` : null))
      .filter((u): u is string => Boolean(u));
  } catch {
    throw new MediaInfoUnavailableError("Could not expand this playlist.");
  }
}
