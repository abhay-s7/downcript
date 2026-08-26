import { MetaAdManifest, MetaAdType, MetaCreative, MetaCreativeKind } from "@/app/lib/services/meta/types";

interface RawCard {
  video_hd_url?: string | null;
  video_sd_url?: string | null;
  original_image_url?: string | null;
  resized_image_url?: string | null;
  title?: string | null;
}

interface RawSnapshot {
  page_name?: string | null;
  // Meta's own classification of the ad -- seen in the wild: "IMAGE",
  // "VIDEO", "CAROUSEL", and "DCO" (Dynamic Creative Optimization: several
  // auto-tested creative variants, NOT a user-facing carousel, even though
  // it also populates multiple `cards` entries). Used as the primary signal
  // over inferring from cards.length, since that alone can't tell a real
  // carousel apart from DCO variants -- confirmed by a real ad returning
  // display_format "DCO" with two different (non-duplicate) image cards.
  display_format?: string | null;
  cards?: RawCard[] | null;
  videos?: RawCard[] | null;
  video_hd_url?: string | null;
  video_sd_url?: string | null;
  original_image_url?: string | null;
  resized_image_url?: string | null;
}

interface RawAdArchive {
  ad_archive_id: string;
  snapshot: RawSnapshot;
}

// The wrapper this sits inside (Relay's "require"/"__bbox" preload cache) is
// internal plumbing that shifted noticeably even between two loads of the
// same ad during development, so this deliberately does not hardcode a path
// down to it -- it walks the whole returned JSON looking for the one shape
// that actually matters: an object with both an ad_archive_id and a
// snapshot. Bounded by the JSON's own (finite, acyclic) structure.
function findAdArchive(node: unknown, depth = 0): RawAdArchive | null {
  if (depth > 25 || node === null || typeof node !== "object") return null;

  if (
    "ad_archive_id" in node &&
    typeof (node as Record<string, unknown>).ad_archive_id === "string" &&
    "snapshot" in node &&
    typeof (node as Record<string, unknown>).snapshot === "object" &&
    (node as Record<string, unknown>).snapshot !== null
  ) {
    return node as unknown as RawAdArchive;
  }

  const values = Array.isArray(node) ? node : Object.values(node as Record<string, unknown>);
  for (const value of values) {
    const found = findAdArchive(value, depth + 1);
    if (found) return found;
  }
  return null;
}

function classifyCard(card: RawCard): { kind: MetaCreativeKind; url: string } | null {
  const videoUrl = card.video_hd_url || card.video_sd_url;
  if (videoUrl) return { kind: "video", url: videoUrl };

  const imageUrl = card.original_image_url || card.resized_image_url;
  if (imageUrl) return { kind: "image", url: imageUrl };

  return null;
}

function adTypeFor(displayFormat: string | null | undefined, creatives: MetaCreative[]): MetaAdType {
  if (creatives.length === 0) return "unknown";

  const normalized = displayFormat?.toUpperCase();
  if (normalized === "CAROUSEL") return "carousel";
  if (normalized === "VIDEO") return "video";
  if (normalized === "IMAGE") return "image";

  // Unknown or "DCO" (multiple auto-tested variants, not a real carousel) --
  // still surface every distinct creative found rather than guessing which
  // one is "the" ad, grouped the same way a real carousel would be.
  if (creatives.length > 1) return "carousel";
  return creatives[0].kind;
}

// Parses whatever raw JSON came back from the hidden BrowserWindow (see
// electron/main.js's meta:resolveAd handler) into a normalized manifest.
// Deliberately tolerant: an ad with no recognizable creative still returns a
// manifest with adType "unknown" and an empty creatives list rather than
// throwing, so the caller can show a clear "no media found" message instead
// of a generic failure.
export function parseAdSnapshot(raw: unknown): MetaAdManifest {
  const archive = findAdArchive(raw);
  if (!archive) {
    throw new Error("Could not find ad data in this page. Meta may have changed their page format.");
  }

  const rawCards = [...(archive.snapshot.cards || []), ...(archive.snapshot.videos || [])];
  // A single-creative ad found in testing didn't always wrap its media in a
  // `cards` entry -- fall back to the snapshot's own top-level fields when
  // cards is empty.
  if (rawCards.length === 0) {
    rawCards.push({
      video_hd_url: archive.snapshot.video_hd_url,
      video_sd_url: archive.snapshot.video_sd_url,
      original_image_url: archive.snapshot.original_image_url,
      resized_image_url: archive.snapshot.resized_image_url,
    });
  }

  const seenUrls = new Set<string>();
  const creatives: MetaCreative[] = [];
  for (const card of rawCards) {
    const classified = classifyCard(card);
    if (!classified || seenUrls.has(classified.url)) continue;
    seenUrls.add(classified.url);
    creatives.push({
      index: creatives.length + 1,
      kind: classified.kind,
      url: classified.url,
      title: card.title || undefined,
    });
  }

  return {
    adArchiveId: archive.ad_archive_id,
    pageName: archive.snapshot.page_name || undefined,
    adType: adTypeFor(archive.snapshot.display_format, creatives),
    creatives,
  };
}
