import { NextRequest, NextResponse } from "next/server";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { TranscriptSegment } from "@/app/types";
import { convertToHinglish } from "@/app/lib/hinglish";
import { NoAudioTrackError, transcribeVideoFile } from "@/app/lib/transcribeVideoFile";
import { buildSingleDocxBuffer, buildSrt, buildTxt } from "@/app/lib/export";

interface MetaTranscribeRequestBody {
  videoPath?: string;
  transcriptBaseName?: string;
  outputFormat?: "original" | "hinglish";
  jobId?: string;
}

// Unlike the rest of Meta Ads' file handling, this writes its exports
// directly next to the source video (TXT/DOCX/SRT all at once) rather than
// waiting for the user to pick a format from ExportMenu -- matching the
// brief's example folder layout, where a transcribed creative always has
// all three sitting alongside it.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as MetaTranscribeRequestBody;
  const { videoPath, transcriptBaseName, jobId } = body;
  const trackingId = typeof jobId === "string" && jobId ? jobId : undefined;
  const outputFormat = body.outputFormat === "original" ? "original" : "hinglish";

  if (!videoPath || !transcriptBaseName) {
    return NextResponse.json({ error: "Missing video path." }, { status: 400 });
  }

  const workDir = await mkdtemp(path.join(tmpdir(), "meta-transcribe-"));
  try {
    const audioPath = path.join(workDir, "audio.wav");

    let segments: TranscriptSegment[];
    try {
      segments = await transcribeVideoFile(videoPath, audioPath, trackingId);
    } catch (err) {
      console.error("Meta transcription failed:", err);
      const message = err instanceof NoAudioTrackError ? err.message : "Transcription failed.";
      return NextResponse.json({ error: message }, { status: 422 });
    }

    let originalSegments: TranscriptSegment[] | undefined;
    if (outputFormat === "hinglish" && segments.length > 0) {
      try {
        originalSegments = segments;
        const hinglishTexts = await convertToHinglish(segments.map((s) => s.text), trackingId);
        segments = segments.map((s, i) => ({ ...s, text: hinglishTexts[i] }));
      } catch (err) {
        console.error("Meta hinglish conversion failed:", err);
        return NextResponse.json({ error: "Hinglish conversion failed." }, { status: 422 });
      }
    }

    const dir = path.dirname(videoPath);
    const txtPath = path.join(dir, `${transcriptBaseName}.txt`);
    const docxPath = path.join(dir, `${transcriptBaseName}.docx`);
    const srtPath = path.join(dir, `${transcriptBaseName}.srt`);

    await Promise.all([
      writeFile(txtPath, buildTxt(transcriptBaseName, segments)),
      buildSingleDocxBuffer(transcriptBaseName, segments).then((buf) => writeFile(docxPath, buf)),
      writeFile(srtPath, buildSrt(segments)),
    ]);

    return NextResponse.json({ segments, originalSegments, txtPath, docxPath, srtPath });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
