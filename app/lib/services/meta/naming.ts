import { MetaAdManifest, MetaCreative } from "@/app/lib/services/meta/types";
import { buildMediaBaseName } from "@/app/lib/services/filesystem/naming";
import { getNamingTemplate } from "@/app/lib/services/settings/namingPreference";

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

// Files still live inside a MetaAd_<id>/ folder (unchanged -- that grouping
// is genuinely useful for a carousel's several creatives and isn't really a
// "filename" concern), but the filename itself now goes through the same
// smart-naming service every other module uses: the advertiser's page name
// as creator, the creative's own title when Meta happened to provide one
// (rare) else "Ad <id>" as the title, and "Meta Ads" as platform.
export function metaAdFolderName(adArchiveId: string): string {
  return `MetaAd_${adArchiveId}`;
}

function adSmartBase(manifest: MetaAdManifest, creative: MetaCreative): string {
  const title = creative.title?.trim() || `Ad ${manifest.adArchiveId}`;
  return buildMediaBaseName(
    { title, creator: manifest.pageName, platform: "Meta Ads" },
    getNamingTemplate()
  );
}

// Single-creative ads get a flat "<base>.ext"; carousels (or DCO's multiple
// variants) get "<base> - Creative 01.ext", "- Creative 02.ext", ... so
// every asset in the folder is still unambiguously tied to its position.
export function metaCreativeFileName(manifest: MetaAdManifest, creative: MetaCreative): string {
  const ext = extensionFor(creative);
  const base = adSmartBase(manifest, creative);
  if (manifest.creatives.length === 1) return `${base}.${ext}`;
  const index = String(creative.index).padStart(2, "0");
  return `${base} - Creative ${index}.${ext}`;
}

// Deliberately the SAME base as metaCreativeFileName (no "_Transcript"
// suffix) -- a transcript/subtitle sharing its video's exact base name,
// differing only by extension, is what lets most video players auto-load a
// same-named .srt alongside the .mp4.
export function metaTranscriptBaseName(manifest: MetaAdManifest, creative: MetaCreative): string {
  const base = adSmartBase(manifest, creative);
  if (manifest.creatives.length === 1) return base;
  const index = String(creative.index).padStart(2, "0");
  return `${base} - Creative ${index}`;
}
