import { MetaAdManifest, MetaCreative } from "@/app/lib/services/meta/types";

function extensionFor(creative: MetaCreative): string {
  try {
    const pathname = new URL(creative.url).pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]{2,4})$/);
    if (match) return match[1].toLowerCase();
  } catch {
    // fall through to kind-based default
  }
  return creative.kind === "video" ? "mp4" : "jpg";
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
