import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { registerCanceler } from "@/app/lib/jobRegistry";
import { extractDailymotionVideoId } from "@/app/lib/dailymotion";
import { resolveYtDlp } from "@/app/lib/ytdlpRuntime";
import { parseYtDlpProgressLine, YtDlpProgress } from "@/app/lib/services/downloader/ytdlpProgress";

export interface DownloadedDailymotionVideo {
  workDir: string;
  videoPath: string;
}

export class DailymotionDownloadTimeoutError extends Error {}
export class DailymotionDownloadRestrictedError extends Error {}

// Normalized progress, parsed from yt-dlp's own "[download] X% of ~YMiB at
// ZMiB/s ETA W" lines — never a fake/timer-based estimate. downloadedBytes
// is derived from percent * totalBytes since yt-dlp only reports the
// percentage directly, not a running byte counter.
export type DailymotionDownloadProgress = YtDlpProgress;

// Dailymotion serves every quality tier as muxed audio+video HLS — there is
// no audio-only format like Instagram Reels have — so "worst" is the
// smallest full video Dailymotion actually offers, keeping the download
// reasonable without relying on yt-dlp's own --extract-audio postprocessing
// (a second, less controllable failure surface that was the source of the
// original reliability problems). The plain video file is handed to the
// same ffmpeg/Whisper pipeline Upload already uses.
const DAILYMOTION_FORMAT = "worst[ext=mp4]/worst";
const DOWNLOAD_TIMEOUT_MS = 8 * 60 * 1000;

// yt-dlp's native HLS downloader fetches fragments one at a time by
// default. Dailymotion videos are frequently 30-90+ minutes long, so even
// the "worst" quality can be hundreds of MB split across 1000+ fragments —
// sequentially that legitimately takes far longer than DOWNLOAD_TIMEOUT_MS.
// This (not a broken format selector or a hung process) was the actual
// cause of downloads appearing to hang forever. Fetching fragments
// concurrently cut download time by ~10-40x in testing against a real,
// ~80-minute Dailymotion video (54min projected -> ~50s actual).
const CONCURRENT_FRAGMENTS = 8;

// Grace period after SIGTERM before escalating to SIGKILL, in case yt-dlp
// (or a postprocessing ffmpeg it spawned) doesn't exit promptly — this is
// what guarantees the download promise always settles instead of a code
// path that could wait forever.
const KILL_GRACE_MS = 5000;

const RESTRICTED_PATTERN = /unavailable|private|removed|restricted|geo.?block/i;

// Downloads a Dailymotion video to a temporary local .mp4 file, waits for
// the download to fully finish, and verifies the file is real before
// returning. Never buffers the video in memory — yt-dlp streams straight to
// disk, which matters on Render's memory-constrained free tier.
export async function downloadDailymotionVideo(
  url: string,
  jobId: string | undefined,
  log: (msg: string) => void,
  onProgress?: (progress: DailymotionDownloadProgress) => void
): Promise<DownloadedDailymotionVideo> {
  const videoId = extractDailymotionVideoId(url);
  if (!videoId) throw new Error("Please enter a valid Dailymotion video URL.");

  const workDir = await mkdtemp(path.join(tmpdir(), "dailymotion-"));
  const videoPath = path.join(workDir, "video.mp4");

  try {
    await runYtDlp(url, videoPath, jobId, log, onProgress);
    log("download completed, verifying output file");

    const { size } = await stat(videoPath);
    if (size === 0) throw new Error("downloaded file is empty");
    log(`output file verified (${size} bytes)`);

    return { workDir, videoPath };
  } catch (err) {
    await rm(workDir, { recursive: true, force: true });
    throw err;
  }
}

// Spawn-based (not execFile/exec) so stdout/stderr can be logged live and so
// SIGTERM/SIGKILL escalation is explicit — execFile's buffered output was
// hiding all yt-dlp activity from the logs for the entire download.
function runYtDlp(
  url: string,
  videoPath: string,
  jobId: string | undefined,
  log: (msg: string) => void,
  onProgress?: (progress: DailymotionDownloadProgress) => void
): Promise<void> {
  const args = [
    "-f", DAILYMOTION_FORMAT,
    "--concurrent-fragments", String(CONCURRENT_FRAGMENTS),
    "--ffmpeg-location", ffmpegPath as string,
    "--no-warnings",
    "--no-playlist",
    "--newline",
    "-o", videoPath,
    url.trim(),
  ];

  const ytDlpPath = resolveYtDlp();
  log(
    `starting yt-dlp (executable=${ytDlpPath}, format=${DAILYMOTION_FORMAT}, ` +
      `concurrent-fragments=${CONCURRENT_FRAGMENTS}, timeout=${DOWNLOAD_TIMEOUT_MS}ms)`
  );

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

    // yt-dlp's progress line repeats on every fragment; only emit/log it
    // when the integer percentage actually changes so real activity stays
    // visible without flooding the logs or the client with events, while
    // every non-progress line (stage markers, warnings) is always logged
    // verbatim.
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

    child.once("exit", (code, signal) => {
      log(`yt-dlp exited (code=${code}, signal=${signal})`);

      if (timedOut) {
        finish(() =>
          reject(new DailymotionDownloadTimeoutError(stderrTail.trim() || "download timed out"))
        );
        return;
      }
      if (code === 0) {
        finish(resolve);
        return;
      }
      const detail = stderrTail.trim() || `yt-dlp exited with code ${code}`;
      log(
        "Dailymotion download failed\n" +
          `Executable: ${ytDlpPath}\n` +
          `URL: ${url}\n` +
          `Exit code: ${code}\n` +
          `stderr:\n${stderrTail.trim() || "(empty)"}`
      );
      finish(() =>
        reject(
          RESTRICTED_PATTERN.test(stderrTail)
            ? new DailymotionDownloadRestrictedError(detail)
            : new Error(detail)
        )
      );
    });
  });
}
