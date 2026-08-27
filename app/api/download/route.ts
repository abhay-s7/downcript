import { NextRequest, NextResponse } from "next/server";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  DownloadFormatChoice,
  DownloadRestrictedError,
  DownloadTimeoutError,
  runDownload,
} from "@/app/lib/services/downloader/runDownload";
import { buildDestinationPath, defaultDownloadDir } from "@/app/lib/services/downloader/destination";

interface DownloadRequestBody {
  url?: string;
  title?: string;
  jobId?: string;
  outputDir?: string;
  format?: "audio" | "best" | "height";
  height?: number;
}

function parseFormatChoice(body: DownloadRequestBody): DownloadFormatChoice {
  if (body.format === "audio") return "audio";
  if (body.format === "height" && typeof body.height === "number") return { height: body.height };
  return "best";
}

// Streams newline-delimited JSON progress events, same contract as
// /api/dailymotion-transcript, so the client's queue can reuse the same
// ndjson-reading pattern for downloads instead of introducing a second one.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as DownloadRequestBody;
  const { url, jobId } = body;
  const trackingId = typeof jobId === "string" && jobId ? jobId : undefined;
  const log = (msg: string) => console.log(`[download ${trackingId ?? "-"}] ${msg}`);

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Please enter a URL." }, { status: 400 });
  }

  const outputDir = body.outputDir || defaultDownloadDir();
  const title = body.title?.trim() || "download";
  const formatChoice = parseFormatChoice(body);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (msg: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(msg) + "\n"));

      try {
        await mkdir(outputDir, { recursive: true });
        const destinationPath = buildDestinationPath(outputDir, title, formatChoice);

        // Deterministic from (outputDir, title, formatChoice) -- a retry or a
        // resume-after-pause recomputes this exact same path, letting yt-dlp's
        // own default partial-file continuation pick up where it left off
        // instead of starting over.
        send({ phase: "preparing", destinationDir: outputDir });
        const result = await runDownload(
          url,
          destinationPath,
          formatChoice,
          trackingId,
          log,
          (progress) => send({ phase: "downloading", ...progress }),
          (phase) => send({ phase })
        );

        log(`download completed: ${result.filePath}`);
        send({ result: { filePath: result.filePath, fileName: path.basename(result.filePath) } });
      } catch (err) {
        log(`download failed: ${err instanceof Error ? err.message : String(err)}`);
        console.error("Download failed:", err);

        const message =
          err instanceof DownloadTimeoutError
            ? "The download took too long and was stopped. Please retry."
            : err instanceof DownloadRestrictedError
            ? "This media cannot be accessed."
            : "Unable to download this URL. Please check the link and try again.";
        send({ error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
