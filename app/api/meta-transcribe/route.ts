import { NextRequest, NextResponse } from "next/server";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { TranscriptSegment } from "@/app/types";
import { convertToHinglish } from "@/app/lib/hinglish";
import { NoAudioTrackError, transcribeVideoFile } from "@/app/lib/transcribeVideoFile";
import { buildSingleDocxBuffer, buildSrt, buildTxt } from "@/app/lib/export";
import { TranscriptFormat } from "@/app/lib/services/meta/types";

interface MetaTranscribeRequestBody {
  videoPath?: string;
  transcriptBaseName?: string;
  outputFormat?: "original" | "hinglish";
  formats?: TranscriptFormat[];
  jobId?: string;
}

// Writes exports directly next to the source video rather than waiting for
// the user to pick a format from ExportMenu (Meta Ads has no on-demand
// "click Export DOCX whenever" moment the way the main Transcript module
// does), but -- unlike an earlier version of this route -- only for the
// format(s) the user actually selected before generating, not all three
// unconditionally. Whisper still runs exactly once regardless of how many
// formats are selected; only the write step below is selective.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as MetaTranscribeRequestBody;
  const { videoPath, transcriptBaseName, jobId } = body;
  const trackingId = typeof jobId === "string" && jobId ? jobId : undefined;
  const outputFormat = body.outputFormat === "original" ? "original" : "hinglish";
  const formats: TranscriptFormat[] =
    Array.isArray(body.formats) && body.formats.length > 0 ? body.formats : ["docx"];

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
    const writtenPaths: Partial<Record<TranscriptFormat, string>> = {};
    const writes: Promise<unknown>[] = [];

    if (formats.includes("txt")) {
      writtenPaths.txt = path.join(dir, `${transcriptBaseName}.txt`);
      writes.push(writeFile(writtenPaths.txt, buildTxt(transcriptBaseName, segments)));
    }
    if (formats.includes("docx")) {
      writtenPaths.docx = path.join(dir, `${transcriptBaseName}.docx`);
      writes.push(buildSingleDocxBuffer(transcriptBaseName, segments).then((buf) => writeFile(writtenPaths.docx!, buf)));
    }
    if (formats.includes("srt")) {
      writtenPaths.srt = path.join(dir, `${transcriptBaseName}.srt`);
      writes.push(writeFile(writtenPaths.srt, buildSrt(segments)));
    }

    await Promise.all(writes);

    return NextResponse.json({ segments, originalSegments, paths: writtenPaths });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
