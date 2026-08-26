// Pure types shared between server-only downloader code (mediaInfo.ts,
// runDownload.ts — both import Node builtins) and client code
// (downloadJobs.ts, useDownloadQueue.ts). Kept dependency-free so importing
// these types into a "use client" file never risks pulling node:child_process
// into the browser bundle.
export interface MediaFormat {
  id: string;
  label: string;
  height?: number;
}

export interface MediaInfo {
  title: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  formats: MediaFormat[];
}
