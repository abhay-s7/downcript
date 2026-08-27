import { MetaAdManifest, MetaCreative } from "@/app/lib/services/meta/types";

// Meta's CDN URLs are almost always a signed link with a real extension in
// the path (before the query string), but this isn't guaranteed -- returns
// null rather than guessing, so callers can tell "found in the URL" apart
// from "had to fall back," and downloadCreative.ts can use that to decide
// whether it's worth sniffing the response's Content-Type instead.
export function extensionFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]{2,4})$/);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

// Only used once the URL itself gave no reliable extension -- see
// downloadCreative.ts, which sniffs the actual HTTP response for this rather
// than blindly writing every image as .jpg.
export const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

function extensionFor(creative: MetaCreative): string {
  return extensionFromUrl(creative.url) ?? (creative.kind === "video" ? "mp4" : "jpg");
}

export function metaAdFolderName(adArchiveId: string): string {
  return `MetaAd_${adArchiveId}`;
}

// Single-creative ads get the brief's flat MetaAd_<id>_Video.mp4 /
// MetaAd_<id>_Image.jpg naming; carousels (or DCO's multiple variants) get
// MetaAd_<id>_Creative_01.ext, _02.ext, ... so every asset in the folder is
// unambiguously tied back to its ad and position.
export function metaCreativeFileName(manifest: MetaAdManifest, creative: MetaCreative): string {
  const ext = extensionFor(creative);
  if (manifest.creatives.length === 1) {
    const label = creative.kind === "video" ? "Video" : "Image";
    return `MetaAd_${manifest.adArchiveId}_${label}.${ext}`;
  }
  const index = String(creative.index).padStart(2, "0");
  return `MetaAd_${manifest.adArchiveId}_Creative_${index}.${ext}`;
}

export function metaTranscriptBaseName(manifest: MetaAdManifest, creative: MetaCreative): string {
  if (manifest.creatives.length === 1) {
    return `MetaAd_${manifest.adArchiveId}_Transcript`;
  }
  const index = String(creative.index).padStart(2, "0");
  return `MetaAd_${manifest.adArchiveId}_Creative_${index}_Transcript`;
}
