import { NextRequest, NextResponse } from "next/server";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { downloadCreativeFile, CreativeDownloadError } from "@/app/lib/services/meta/downloadCreative";
import { defaultDownloadDir } from "@/app/lib/services/downloader/destination";

interface MetaDownloadRequestBody {
  url?: string;
  fileName?: string;
  adArchiveId?: string;
  outputDir?: string;
  jobId?: string;
}

// Same ndjson streaming contract as /api/download -- a direct HTTPS transfer
// rather than a yt-dlp invocation, but the client's progress-reading code
// doesn't need to know or care which.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as MetaDownloadRequestBody;
  const { url, fileName, adArchiveId, jobId } = body;
  const trackingId = typeof jobId === "string" && jobId ? jobId : undefined;
  const log = (msg: string) => console.log(`[meta-download ${trackingId ?? "-"}] ${msg}`);

  if (!url || !fileName || !adArchiveId) {
    return NextResponse.json({ error: "Missing creative details." }, { status: 400 });
  }

  const outputDir = path.join(body.outputDir || defaultDownloadDir(), `MetaAd_${adArchiveId}`);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (msg: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(msg) + "\n"));

      try {
        await mkdir(outputDir, { recursive: true });
        const destinationPath = path.join(outputDir, fileName);

        send({ phase: "downloading" });
        log(`downloading ${url} -> ${destinationPath}`);
        const result = await downloadCreativeFile(url, destinationPath, trackingId, (progress) =>
          send({ phase: "downloading", ...progress })
        );

        log(`completed: ${result.filePath}`);
        send({ result: { filePath: result.filePath, fileName: path.basename(result.filePath) } });
      } catch (err) {
        log(`failed: ${err instanceof Error ? err.message : String(err)}`);
        console.error("Meta creative download failed:", err);
        const message =
          err instanceof CreativeDownloadError
            ? err.message
            : "Unable to download this creative. Please try again.";
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
