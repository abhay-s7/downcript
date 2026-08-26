import path from "node:path";
import os from "node:os";
import { sanitizeFileBaseName } from "@/app/lib/services/filesystem/naming";
import { DownloadFormatChoice } from "@/app/lib/services/downloader/runDownload";

// ~/Downloads/Downcript by default, matching Downly's ~/Downloads/Downly
// convention (renamed) — overridden by DEFAULT_DOWNLOAD_DIR when running
// under Electron (see electron/main.js) or by an explicit folder the user
// picked via the "Choose folder" dialog.
export function defaultDownloadDir(): string {
  return process.env.DEFAULT_DOWNLOAD_DIR || path.join(os.homedir(), "Downloads", "Downcript");
}

export function buildDestinationPath(
  outputDir: string,
  title: string,
  formatChoice: DownloadFormatChoice
): string {
  const ext = formatChoice === "audio" ? "mp3" : "mp4";
  const base = sanitizeFileBaseName(title).slice(0, 100);
  // Genuinely dynamic user-chosen destination, not a project-relative
  // lookup -- same reasoning as ytdlpRuntime.ts's existsSync calls, opting
  // out of Turbopack's build-time tracing rather than pulling the whole
  // project into the standalone server output.
  return path.join(/* turbopackIgnore: true */ outputDir, `${base}.${ext}`);
}
