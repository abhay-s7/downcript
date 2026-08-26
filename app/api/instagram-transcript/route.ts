import { NextRequest, NextResponse } from "next/server";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { TranscriptSegment } from "@/app/types";
import { convertToHinglish } from "@/app/lib/hinglish";
import { extractInstagramReelId } from "@/app/lib/instagram";
import { execFileTracked } from "@/app/lib/process";
import { resolvePythonTool } from "@/app/lib/pythonRuntime";
import { resolveYtDlp } from "@/app/lib/ytdlpRuntime";

export async function POST(req: NextRequest) {
  let workDir: string | null = null;

  try {
    const { url, outputFormat: rawOutputFormat, jobId } = await req.json();
    const trackingId = typeof jobId === "string" && jobId ? jobId : undefined;

    if (!url || typeof url !== "string" || !extractInstagramReelId(url)) {
      return NextResponse.json(
        { error: "Please enter a valid Instagram Reel URL." },
        { status: 400 }
      );
    }

    const outputFormat = rawOutputFormat === "original" ? "original" : "hinglish";

    workDir = await mkdtemp(path.join(tmpdir(), "instagram-"));
    const downloadedPath = path.join(workDir, "downloaded.wav");
    const audioPath = path.join(workDir, "audio.wav");

    try {
      await execFileTracked(
        trackingId,
        resolveYtDlp(),
        [
          "-f", "bestaudio/best",
          "--extract-audio",
          "--audio-format", "wav",
          "--ffmpeg-location", ffmpegPath as string,
          "--no-warnings",
          "--no-playlist",
          "-o", downloadedPath,
          url.trim(),
        ],
        { maxBuffer: 1024 * 1024 * 50 }
      );
    } catch (err) {
      console.error("Instagram media retrieval failed:", err);
      return NextResponse.json(
        {
          error:
            "Unable to access this Instagram Reel. Make sure the Reel is publicly accessible.",
        },
        { status: 502 }
      );
    }

    try {
      await execFileTracked(trackingId, ffmpegPath as string, [
        "-y",
        "-i", downloadedPath,
        "-ar", "16000",
        "-ac", "1",
        "-c:a", "pcm_s16le",
        audioPath,
      ]);
    } catch (err) {
      console.error("Instagram audio extraction failed:", err);
      return NextResponse.json({ error: "Could not retrieve the Reel." }, { status: 500 });
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
      console.error("Instagram transcription failed:", err);
      return NextResponse.json({ error: "Could not transcribe this Reel." }, { status: 500 });
    }

    let originalSegments: TranscriptSegment[] | undefined;
    if (outputFormat === "hinglish" && segments.length > 0) {
      try {
        originalSegments = segments;
        const hinglishTexts = await convertToHinglish(segments.map((s) => s.text), trackingId);
        segments = segments.map((s, i) => ({ ...s, text: hinglishTexts[i] }));
      } catch (err) {
        console.error("Hinglish conversion failed:", err);
        return NextResponse.json({ error: "Hinglish conversion failed." }, { status: 500 });
      }
    }

    return NextResponse.json({ segments, originalSegments });
  } catch (err) {
    console.error("Instagram transcript failed:", err);
    return NextResponse.json({ error: "Could not retrieve the Reel." }, { status: 500 });
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true });
  }
}
