import { NextRequest, NextResponse } from "next/server";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { TranscriptSegment } from "@/app/types";
import { convertToHinglish } from "@/app/lib/hinglish";
import { NoAudioTrackError, transcribeVideoFile } from "@/app/lib/transcribeVideoFile";
import { buildSingleDocxBuffer, buildSrt, buildTxt } from "@/app/lib/export";
import { TranscriptFormat } from "@/app/lib/services/meta/types";
import { downloadCreativeFile } from "@/app/lib/services/meta/downloadCreative";
import { defaultDownloadDir } from "@/app/lib/services/downloader/destination";

interface MetaTranscribeRequestBody {
  videoPath?: string;
  videoUrl?: string;
  outputDir?: string;
  adArchiveId?: string;
  transcriptBaseName?: string;
  outputFormat?: "original" | "hinglish";
  formats?: TranscriptFormat[];
  jobId?: string;
}

// Writes exports directly next to where the video lives (or would live)
// rather than waiting for the user to pick a format from ExportMenu, but
// only for the format(s) actually selected -- Whisper still runs exactly
// once regardless of how many formats are chosen; only the write step below
// is selective.
//
// Two distinct callers, both handled here:
// - The video was already downloaded and kept (videoPath given) -- used
//   in place, never touched otherwise ("Download Video + Transcript").
// - "Transcript Only": the video is NOT meant to be a kept output. videoUrl
//   is fetched into a throwaway temp file, used for transcription, and
//   deleted -- only the transcript export(s) end up in the ad's folder.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as MetaTranscribeRequestBody;
  const { transcriptBaseName, jobId } = body;
  const trackingId = typeof jobId === "string" && jobId ? jobId : undefined;
  const outputFormat = body.outputFormat === "original" ? "original" : "hinglish";
  const formats: TranscriptFormat[] =
    Array.isArray(body.formats) && body.formats.length > 0 ? body.formats : ["docx"];

  if (!transcriptBaseName || (!body.videoPath && !body.videoUrl)) {
    return NextResponse.json({ error: "Missing video." }, { status: 400 });
  }

  const workDir = await mkdtemp(path.join(tmpdir(), "meta-transcribe-"));
  try {
    let videoPath = body.videoPath;
    let exportDir: string;

    if (videoPath) {
      exportDir = path.dirname(videoPath);
    } else {
      if (!body.adArchiveId) {
        return NextResponse.json({ error: "Missing ad reference." }, { status: 400 });
      }
      exportDir = path.join(body.outputDir || defaultDownloadDir(), `MetaAd_${body.adArchiveId}`);
      await mkdir(exportDir, { recursive: true });

      // Lives inside workDir, so the outer cleanup (finally, below) removes
      // it too -- this is deliberately never a kept output.
      try {
        const result = await downloadCreativeFile(body.videoUrl!, path.join(workDir, "source.mp4"), trackingId);
        videoPath = result.filePath;
      } catch (err) {
        console.error("Meta transcript-only fetch failed:", err);
        return NextResponse.json({ error: "Unable to fetch this video for transcription." }, { status: 422 });
      }
    }

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

    const writtenPaths: Partial<Record<TranscriptFormat, string>> = {};
    const writes: Promise<unknown>[] = [];

    if (formats.includes("txt")) {
      writtenPaths.txt = path.join(exportDir, `${transcriptBaseName}.txt`);
      writes.push(writeFile(writtenPaths.txt, buildTxt(transcriptBaseName, segments)));
    }
    if (formats.includes("docx")) {
      writtenPaths.docx = path.join(exportDir, `${transcriptBaseName}.docx`);
      writes.push(buildSingleDocxBuffer(transcriptBaseName, segments).then((buf) => writeFile(writtenPaths.docx!, buf)));
    }
    if (formats.includes("srt")) {
      writtenPaths.srt = path.join(exportDir, `${transcriptBaseName}.srt`);
      writes.push(writeFile(writtenPaths.srt, buildSrt(segments)));
    }

    await Promise.all(writes);

    return NextResponse.json({ segments, originalSegments, paths: writtenPaths });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
