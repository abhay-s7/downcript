import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { registerCanceler } from "@/app/lib/jobRegistry";
import { resolveYtDlp } from "@/app/lib/ytdlpRuntime";
import { parseYtDlpProgressLine, YtDlpProgress } from "@/app/lib/services/downloader/ytdlpProgress";
import { dedupeFilePath } from "@/app/lib/services/filesystem/dedupePath";

export class DownloadTimeoutError extends Error {}
export class DownloadRestrictedError extends Error {}

export type DownloadFormatChoice = "audio" | "best" | { height: number };

export interface DownloadResult {
  filePath: string;
}

// Same 8-minute timeout + concurrent-fragment tuning already proven for
// Dailymotion's HLS downloads (see app/lib/dailymotionDownload.ts) rather
// than Downly's flat 5-minute timeout with sequential fragments — that
// combination was the actual cause of Downly-style downloads looking
// "hung" on longer videos, not a stuck process. Applying the better of the
// two source apps' implementations here rather than porting Downly's as-is.
const DOWNLOAD_TIMEOUT_MS = 8 * 60 * 1000;
const CONCURRENT_FRAGMENTS = 8;
const KILL_GRACE_MS = 5000;
const RESTRICTED_PATTERN = /unavailable|private|removed|restricted|geo.?block/i;

function buildFormatArgs(choice: DownloadFormatChoice): string[] {
  if (choice === "audio") {
    return ["-x", "--audio-format", "mp3"];
  }
  // "-S vcodec:h264[,res:N]" prefers an H.264 stream at (up to) the chosen
  // height with an H.264 fallback if the exact height's best stream is
  // VP9/AV1-only — ported from Downly's app.py, which found this necessary
  // particularly for Instagram; ",res:N" narrows to a specific height on top.
  const sort = choice === "best" ? "vcodec:h264" : `vcodec:h264,res:${choice.height}`;
  return ["-S", sort, "-f", "bv*+ba/b", "--merge-output-format", "mp4"];
}

// Downloads `url` straight to `destinationPath` (already dedup-checked by
// the caller against the user's chosen folder), reporting live progress
// parsed from yt-dlp's own stdout and supporting real cancellation via the
// existing job registry — the same registry /api/job-cancel already talks
// to for transcription jobs.
export function runDownload(
  url: string,
  destinationPath: string,
  formatChoice: DownloadFormatChoice,
  jobId: string | undefined,
  log: (msg: string) => void,
  onProgress?: (progress: YtDlpProgress) => void
): Promise<DownloadResult> {
  const finalPath = dedupeFilePath(destinationPath);
  const outTemplate = finalPath.replace(/\.[^/.]+$/, "") + ".%(ext)s";

  const args = [
    "--no-playlist",
    "--newline",
    "--no-warnings",
    "--concurrent-fragments", String(CONCURRENT_FRAGMENTS),
    "--ffmpeg-location", ffmpegPath as string,
    ...buildFormatArgs(formatChoice),
    "-o", outTemplate,
    url.trim(),
  ];

  const ytDlpPath = resolveYtDlp();
  log(`starting yt-dlp (executable=${ytDlpPath}, args=${JSON.stringify(args)})`);

  return new Promise((resolve, reject) => {
    const child = spawn(ytDlpPath, args);
    log(`yt-dlp started (pid=${child.pid})`);

    let stderrTail = "";
    let timedOut = false;
    let settled = false;
    let forceKillTimer: ReturnType<typeof setTimeout> | undefined;

    const terminate = (signal: NodeJS.Signals) => {
      child.kill(signal);
      forceKillTimer = setTimeout(() => {
        log("yt-dlp did not exit after SIGTERM, sending SIGKILL");
        child.kill("SIGKILL");
      }, KILL_GRACE_MS);
    };

    const unregister = jobId
      ? registerCanceler(jobId, () => {
          log("cancel requested, terminating yt-dlp");
          terminate("SIGTERM");
        })
      : undefined;

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      log(`download exceeded ${DOWNLOAD_TIMEOUT_MS}ms, terminating yt-dlp`);
      terminate("SIGTERM");
    }, DOWNLOAD_TIMEOUT_MS);

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      unregister?.();
      fn();
    };

    let lastEmittedPercent = -1;
    child.stdout.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        const progress = parseYtDlpProgressLine(line);
        if (progress) {
          const percent = Math.floor(progress.percent);
          if (percent === lastEmittedPercent) continue;
          lastEmittedPercent = percent;
          log(`download progress: ${percent}%`);
          onProgress?.(progress);
          continue;
        }
        log(`yt-dlp stdout: ${line}`);
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (!text) return;
      stderrTail = `${stderrTail}\n${text}`.slice(-4000);
      log(`yt-dlp stderr: ${text}`);
    });

    child.once("error", (err) => {
      log(`yt-dlp process error: ${err.message}`);
      finish(() => reject(err));
    });

    child.once("exit", async (code) => {
      log(`yt-dlp exited (code=${code})`);

      if (timedOut) {
        finish(() => reject(new DownloadTimeoutError(stderrTail.trim() || "Download timed out")));
        return;
      }
      if (code !== 0) {
        const detail = stderrTail.trim() || `yt-dlp exited with code ${code}`;
        finish(() =>
          reject(RESTRICTED_PATTERN.test(stderrTail) ? new DownloadRestrictedError(detail) : new Error(detail))
        );
        return;
      }

      // yt-dlp resolved "%(ext)s" itself (mp3 for audio, mp4/webm/etc for
      // video) — find whichever file it actually produced next to the
      // template, mirroring Downly's glob-and-pick-the-real-one approach.
      const dir = path.dirname(outTemplate);
      const base = path.basename(outTemplate).replace(/\.%\(ext\)s$/, "");
      const producedExt = formatChoice === "audio" ? "mp3" : "mp4";
      // Dynamic user-chosen destination, not project-relative -- see
      // destination.ts for why these opt out of Turbopack's build tracing.
      const producedPath = path.join(/* turbopackIgnore: true */ dir, `${base}.${producedExt}`);
      if (!existsSync(/* turbopackIgnore: true */ producedPath)) {
        finish(() => reject(new Error("Download finished but the output file could not be found.")));
        return;
      }

      try {
        const { size } = await stat(/* turbopackIgnore: true */ producedPath);
        if (size === 0) throw new Error("downloaded file is empty");
      } catch (err) {
        finish(() => reject(err instanceof Error ? err : new Error(String(err))));
        return;
      }

      finish(() => resolve({ filePath: producedPath }));
    });
  });
}
