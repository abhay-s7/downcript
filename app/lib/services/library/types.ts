// Shared shape for a Media Library entry -- persisted by the Electron main
// process (see electron/main.js's library store), not this app's Next.js
// server, since Rename/Delete/Open need real filesystem/shell access and one
// of the three registration paths (Transcript-tab exports, via
// session.will-download) only exists in the main process to begin with.
export type MediaKind = "video" | "audio" | "image" | "transcript" | "other";

export type LibrarySourceModule = "download" | "meta-ads" | "transcript-export" | "scan";

export type LibraryStatus = "completed" | "failed";

export interface LibraryEntry {
  // Stable across upserts -- a queue job's own id (download card / meta
  // creative) when one exists, so a retry updates the same record instead of
  // duplicating it; a fresh id for anything discovered without one (a
  // will-download catch, or a folder scan result keyed by path).
  id: string;
  filePath?: string; // absent for a failed entry that never produced a file
  fileName: string;
  title?: string;
  sourceModule: LibrarySourceModule;
  platform?: string; // "YouTube", "Instagram", "Meta Ads", ...
  sourceUrl?: string;
  kind: MediaKind;
  ext: string;
  sizeBytes?: number;
  durationSeconds?: number;
  status: LibraryStatus;
  error?: string;
  createdAt: number; // epoch ms -- preserved across re-upserts of the same id
  updatedAt: number;
  thumbnail?: string; // only ever a URL already known from elsewhere (e.g. yt-dlp) -- never generated
}

// What a caller (a queue hook, or the scan handler) sends in -- main.js fills
// in sizeBytes (via fs.stat), createdAt/updatedAt, and persists/broadcasts.
export type LibraryEntryInput = Omit<LibraryEntry, "sizeBytes" | "createdAt" | "updatedAt">;

const EXTENSION_KIND: Record<string, MediaKind> = {
  mp4: "video",
  mov: "video",
  mkv: "video",
  webm: "video",
  avi: "video",
  mp3: "audio",
  m4a: "audio",
  wav: "audio",
  jpg: "image",
  jpeg: "image",
  png: "image",
  webp: "image",
  gif: "image",
  avif: "image",
  bmp: "image",
  txt: "transcript",
  docx: "transcript",
  srt: "transcript",
};

export function kindForExtension(ext: string): MediaKind {
  return EXTENSION_KIND[ext.toLowerCase().replace(/^\./, "")] ?? "other";
}

export const RECOGNIZED_EXTENSIONS = Object.keys(EXTENSION_KIND);
