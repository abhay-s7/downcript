import { NextRequest, NextResponse } from "next/server";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { TranscriptSegment } from "@/app/types";
import { convertToHinglish } from "@/app/lib/hinglish";
import { NoAudioTrackError, transcribeVideoFile } from "@/app/lib/transcribeVideoFile";
import { isAllowedUploadFile } from "@/app/lib/uploadFormats";

export async function POST(req: NextRequest) {
  let workDir: string | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const jobId = formData.get("jobId");
    const trackingId = typeof jobId === "string" && jobId ? jobId : undefined;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Please select a video or audio file." }, { status: 400 });
    }

    if (!isAllowedUploadFile(file.name)) {
      return NextResponse.json(
        { error: "Please select a supported video or audio file." },
        { status: 400 }
      );
    }

    const outputFormat = formData.get("outputFormat") === "hinglish" ? "hinglish" : "original";

    workDir = await mkdtemp(path.join(tmpdir(), "transcribe-"));
    // Preserves the real extension (not hardcoded to .mp4 anymore) so ffmpeg
    // sees a sensible container hint for audio-only uploads too.
    const ext = path.extname(file.name).toLowerCase();
    const videoPath = path.join(workDir, `source${ext}`);
    const audioPath = path.join(workDir, "audio.wav");

    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(videoPath, bytes);

    let segments: TranscriptSegment[] = await transcribeVideoFile(videoPath, audioPath, trackingId);

    let originalSegments: TranscriptSegment[] | undefined;
    if (outputFormat === "hinglish" && segments.length > 0) {
      try {
        originalSegments = segments;
        const hinglishTexts = await convertToHinglish(segments.map((s) => s.text), trackingId);
        segments = segments.map((s, i) => ({ ...s, text: hinglishTexts[i] }));
      } catch (err) {
        console.error("Hinglish conversion failed:", err);
        return NextResponse.json(
          { error: "Hinglish conversion failed." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ segments, originalSegments });
  } catch (err) {
    console.error("Transcription failed:", err);
    if (err instanceof NoAudioTrackError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: "Transcription failed. Please try again." },
      { status: 500 }
    );
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true });
  }
}
