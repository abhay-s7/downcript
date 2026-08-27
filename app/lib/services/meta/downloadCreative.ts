import { createWriteStream } from "node:fs";
import https from "node:https";
import path from "node:path";
import { registerCanceler } from "@/app/lib/jobRegistry";
import { dedupeFilePath } from "@/app/lib/services/filesystem/dedupePath";
import { CONTENT_TYPE_EXTENSIONS, extensionFromUrl } from "@/app/lib/services/meta/naming";
import { YtDlpProgress } from "@/app/lib/services/downloader/ytdlpProgress";

export class CreativeDownloadError extends Error {}

function withExtension(filePath: string, ext: string): string {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  // Always a user-chosen destination outside the project tree -- same
  // turbopackIgnore reasoning as dedupeFilePath.ts/destination.ts.
  return path.join(/* turbopackIgnore: true */ dir, `${base}.${ext}`);
}

// Meta's CDN URLs are already direct file links (no site extraction needed,
// unlike the generic downloader's yt-dlp path) -- a plain HTTPS GET streamed
// to disk is all this needs. Reuses YtDlpProgress's shape (percent/bytes)
// rather than inventing a parallel type, since the download UI already knows
// how to render it.
export function downloadCreativeFile(
  url: string,
  destinationPath: string,
  jobId: string | undefined,
  onProgress?: (progress: YtDlpProgress) => void
): Promise<{ filePath: string }> {
  // naming.ts already put a real extension on destinationPath when the URL
  // itself had one. When it didn't, it fell back to a kind-based guess
  // (jpg/mp4) -- rather than trust that guess, sniff the actual
  // Content-Type once the response headers are in and correct the
  // destination before anything is written to disk.
  const extensionIsGuessed = extensionFromUrl(url) === null;

  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 400) {
        response.resume();
        reject(new CreativeDownloadError(`Meta's server returned ${response.statusCode} for this creative.`));
        return;
      }

      let targetPath = destinationPath;
      if (extensionIsGuessed) {
        const contentType = (response.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
        const mappedExt = CONTENT_TYPE_EXTENSIONS[contentType];
        if (mappedExt) targetPath = withExtension(destinationPath, mappedExt);
      }
      const finalPath = dedupeFilePath(targetPath);

      const totalBytes = Number(response.headers["content-length"]) || undefined;
      let downloadedBytes = 0;
      let lastEmittedPercent = -1;

      const fileStream = createWriteStream(finalPath);

      response.on("data", (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        if (!totalBytes) return;
        const percent = Math.floor((downloadedBytes / totalBytes) * 100);
        if (percent === lastEmittedPercent) return;
        lastEmittedPercent = percent;
        onProgress?.({ percent, downloadedBytes, totalBytes });
      });

      response.pipe(fileStream);
      fileStream.on("finish", () => resolve({ filePath: finalPath }));
      fileStream.on("error", (err) => reject(err));
      response.on("error", (err) => reject(err));
    });

    request.on("error", (err) => reject(err));

    const unregister = jobId ? registerCanceler(jobId, () => request.destroy()) : undefined;
    request.on("close", () => unregister?.());
  });
}
