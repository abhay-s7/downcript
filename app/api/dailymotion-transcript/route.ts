import { NextRequest, NextResponse } from "next/server";
import { rm } from "node:fs/promises";
import path from "node:path";
import { TranscriptSegment } from "@/app/types";
import { convertToHinglish } from "@/app/lib/hinglish";
import { extractDailymotionVideoId } from "@/app/lib/dailymotion";
import {
  DailymotionDownloadRestrictedError,
  DailymotionDownloadTimeoutError,
  downloadDailymotionVideo,
} from "@/app/lib/dailymotionDownload";
import { NoAudioTrackError, transcribeVideoFile } from "@/app/lib/transcribeVideoFile";

// Streams newline-delimited JSON phase events (downloading / downloaded /
// transcribing) followed by a final {result} or {error} line, so the UI can
// show Dailymotion's extra download step instead of a single opaque
// "Processing..." — everything else about the request/response contract
// (one POST, same body shape client already parses) is unchanged.
export async function POST(req: NextRequest) {
  const { url, outputFormat: rawOutputFormat, jobId } = await req.json();
  const trackingId = typeof jobId === "string" && jobId ? jobId : undefined;
  const log = (msg: string) => console.log(`[DM ${trackingId ?? "-"}] ${msg}`);

  log(`URL received: ${url}`);

  if (!url || typeof url !== "string" || !extractDailymotionVideoId(url)) {
    log("rejected: invalid URL");
    return NextResponse.json(
      { error: "Please enter a valid Dailymotion video URL." },
      { status: 400 }
    );
  }
  log("URL validated");

  const outputFormat = rawOutputFormat === "original" ? "original" : "hinglish";

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (msg: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(msg) + "\n"));

      let workDir: string | null = null;
      try {
        let videoPath: string;
        try {
          log("starting download");
          send({ phase: "downloading" });
          const downloaded = await downloadDailymotionVideo(url, trackingId, log, (progress) =>
            send({ phase: "downloading", ...progress })
          );
          workDir = downloaded.workDir;
          videoPath = downloaded.videoPath;
          log("download completed");
          send({ phase: "downloaded" });
        } catch (err) {
          log(`download failed: ${err instanceof Error ? err.message : String(err)}`);
          console.error("Dailymotion download failed:", err);

          const message =
            err instanceof DailymotionDownloadTimeoutError
              ? "The Dailymotion download took too long and was stopped. Please retry."
              : err instanceof DailymotionDownloadRestrictedError
              ? "This Dailymotion video cannot be accessed."
              : "Unable to download this Dailymotion video.";
          send({ error: message });
          return;
        }

        const audioPath = path.join(workDir, "audio.wav");

        let segments: TranscriptSegment[];
        log("sending file to existing upload processor");
        try {
          log("transcription started");
          send({ phase: "transcribing", elapsedSeconds: 0 });

          // faster-whisper (scripts/transcribe.py, shared with every other
          // source) doesn't expose a progress callback, so there is no real
          // percentage to report here without changing that shared script.
          // Elapsed time is genuine wall-clock progress, not a fake bar.
          const transcribeStart = Date.now();
          const elapsedTimer = setInterval(() => {
            send({ phase: "transcribing", elapsedSeconds: Math.floor((Date.now() - transcribeStart) / 1000) });
          }, 1000);
          try {
            segments = await transcribeVideoFile(videoPath, audioPath, trackingId);
          } finally {
            clearInterval(elapsedTimer);
          }
          log(`transcription completed (${segments.length} segments)`);
        } catch (err) {
          log(
            `existing transcription pipeline failed: ${err instanceof Error ? err.message : String(err)}`
          );
          console.error("Dailymotion transcription failed:", err);
          send({ error: err instanceof NoAudioTrackError ? err.message : "Transcription failed." });
          return;
        }

        let originalSegments: TranscriptSegment[] | undefined;
        if (outputFormat === "hinglish" && segments.length > 0) {
          log("starting hinglish conversion");
          try {
            originalSegments = segments;
            const hinglishTexts = await convertToHinglish(segments.map((s) => s.text), trackingId);
            segments = segments.map((s, i) => ({ ...s, text: hinglishTexts[i] }));
            log("hinglish conversion completed");
          } catch (err) {
            log(`hinglish conversion failed: ${err instanceof Error ? err.message : String(err)}`);
            console.error("Hinglish conversion failed:", err);
            send({ error: "Hinglish conversion failed." });
            return;
          }
        }

        send({ result: { segments, originalSegments } });
      } catch (err) {
        log(`job failed unexpectedly: ${err instanceof Error ? err.message : String(err)}`);
        console.error("Dailymotion transcript failed:", err);
        send({ error: "Transcription failed." });
      } finally {
        if (workDir) {
          await rm(workDir, { recursive: true, force: true });
          log("temporary file cleaned");
        }
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
