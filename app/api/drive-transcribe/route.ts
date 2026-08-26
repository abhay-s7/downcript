import { NextRequest, NextResponse } from "next/server";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { TranscriptSegment } from "@/app/types";
import { convertToHinglish } from "@/app/lib/hinglish";
import { downloadDriveFile } from "@/app/lib/googleDrive";
import { execFileTracked } from "@/app/lib/process";
import { registerCanceler } from "@/app/lib/jobRegistry";
import { resolvePythonTool } from "@/app/lib/pythonRuntime";

export async function POST(req: NextRequest) {
  let workDir: string | null = null;

  try {
    const {
      fileId,
      resourceKey,
      fileName,
      outputFormat: rawOutputFormat,
      jobId,
    } = await req.json();
    const trackingId = typeof jobId === "string" && jobId ? jobId : undefined;

    if (!fileId || typeof fileId !== "string") {
      return NextResponse.json(
        { error: "A Google Drive file ID is required." },
        { status: 400 }
      );
    }

    const displayName = typeof fileName === "string" && fileName ? fileName : "This video";
    const outputFormat = rawOutputFormat === "original" ? "original" : "hinglish";

    workDir = await mkdtemp(path.join(tmpdir(), "gdrive-"));
    const videoPath = path.join(workDir, "video.mp4");
    const audioPath = path.join(workDir, "audio.wav");

    const downloadController = new AbortController();
    const unregisterDownload = trackingId
      ? registerCanceler(trackingId, () => downloadController.abort())
      : undefined;

    try {
      await downloadDriveFile(
        fileId,
        typeof resourceKey === "string" ? resourceKey : null,
        videoPath,
        downloadController.signal
      );
    } catch (err) {
      console.error(`Google Drive download failed for ${displayName}:`, err);
      return NextResponse.json(
        { error: `${displayName} could not be transcribed.` },
        { status: 502 }
      );
    } finally {
      unregisterDownload?.();
    }

    try {
      await execFileTracked(trackingId, ffmpegPath as string, [
        "-y",
        "-i", videoPath,
        "-ar", "16000",
        "-ac", "1",
        "-c:a", "pcm_s16le",
        audioPath,
      ]);
    } catch (err) {
      console.error(`Audio extraction failed for ${displayName}:`, err);
      return NextResponse.json(
        { error: `${displayName} could not be transcribed.` },
        { status: 500 }
      );
    }

    let segments: TranscriptSegment[];
    try {
      const { command, args } = resolvePythonTool("transcribe", "scripts/transcribe.py");
      const { stdout } = await execFileTracked(trackingId, command, [...args, audioPath], {
        maxBuffer: 1024 * 1024 * 50,
      });
      const raw = JSON.parse(stdout) as { text: string; start: number; duration: number }[];
      segments = raw.map((s) => ({ text: s.text, start: s.start, duration: s.duration }));
    } catch (err) {
      console.error(`Transcription failed for ${displayName}:`, err);
      return NextResponse.json(
        { error: `${displayName} could not be transcribed.` },
        { status: 500 }
      );
    }

    let originalSegments: TranscriptSegment[] | undefined;
    if (outputFormat === "hinglish" && segments.length > 0) {
      try {
        originalSegments = segments;
        const hinglishTexts = await convertToHinglish(segments.map((s) => s.text), trackingId);
        segments = segments.map((s, i) => ({ ...s, text: hinglishTexts[i] }));
      } catch (err) {
        console.error(`Hinglish conversion failed for ${displayName}:`, err);
        return NextResponse.json(
          { error: `${displayName} could not be transcribed.` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ segments, originalSegments });
  } catch (err) {
    console.error("Google Drive transcription failed:", err);
    return NextResponse.json(
      { error: "This video could not be transcribed." },
      { status: 500 }
    );
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true });
  }
}
