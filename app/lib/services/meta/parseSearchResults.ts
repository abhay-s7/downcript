import { classifyCard, RawAdArchive } from "@/app/lib/services/meta/parseSnapshot";
import { MetaAdType, MetaCreativeKind } from "@/app/lib/services/meta/types";

// One card in the native Competitor Ad Research grid. Every field is
// optional except adArchiveId -- Meta's search-result JSON is less uniform
// than a single resolved ad's deeplink shape, and a field that genuinely
// isn't present is omitted from the card rather than filled with an
// invented value.
export interface MetaSearchResultCard {
  adArchiveId: string;
  pageId?: string;
  pageName?: string;
  pageProfilePictureUrl?: string;
  isActive?: boolean;
  bodyText?: string;
  headline?: string;
  mediaType: MetaAdType;
  creativeKind?: MetaCreativeKind;
  thumbnailUrl?: string;
  videoUrl?: string;
  platforms?: string[];
  startDateLabel?: string;
  // A real, parsed point in time (epoch ms), derived from the same raw
  // fields as startDateLabel -- kept separate because that label is a
  // locale-formatted *display* string (sometimes a "start - end" range),
  // not something safe to re-parse and compare chronologically. Omitted
  // (not substituted with "now" or anything else) when no field this app
  // has access to could be reliably parsed.
  startDateMs?: number;
}

function firstNonEmptyString(...candidates: Array<string | null | undefined>): string | undefined {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return undefined;
}

function bodyTextOf(body: RawAdArchive["snapshot"]["body"]): string | undefined {
  if (!body) return undefined;
  if (typeof body === "string") return body.trim() || undefined;
  return firstNonEmptyString(body.text);
}

function formatStartDate(archive: RawAdArchive): string | undefined {
  // Tried in order of how likely each is to actually be present -- never
  // more than one is used, and an unparseable/absent value is omitted
  // rather than guessed at.
  if (typeof archive.start_date_formatted === "string" && archive.start_date_formatted.trim()) {
    return archive.start_date_formatted.trim();
  }
  if (typeof archive.start_date === "number" && archive.start_date > 0) {
    try {
      return new Date(archive.start_date * 1000).toLocaleDateString();
    } catch {
      return undefined;
    }
  }
  if (typeof archive.ad_delivery_start_time === "string" && archive.ad_delivery_start_time.trim()) {
    const parsed = new Date(archive.ad_delivery_start_time);
    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString();
  }
  return undefined;
}

// Same fields, same priority order as formatStartDate above, but returns an
// actual comparable timestamp instead of a display string -- used for
// genuine chronological sorting ("Most recent"), which can't be done
// reliably by re-parsing a locale-formatted label or a "start - end" range.
function startDateMsOf(archive: RawAdArchive): number | undefined {
  if (typeof archive.start_date === "number" && archive.start_date > 0) {
    return archive.start_date * 1000;
  }
  if (typeof archive.ad_delivery_start_time === "string" && archive.ad_delivery_start_time.trim()) {
    const parsed = new Date(archive.ad_delivery_start_time);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }
  if (typeof archive.start_date_formatted === "string" && archive.start_date_formatted.trim()) {
    // A DOM-extracted card (see electron/main.js) only ever has this field,
    // sometimes as a "10 Sep 2026 - 30 Sep 2026" range -- the start of the
    // range is what "start date" means here, so only the first half is
    // parsed.
    const firstPart = archive.start_date_formatted.split(/\s*-\s*/)[0].trim();
    const parsed = new Date(firstPart);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }
  return undefined;
}

function mediaTypeFor(displayFormat: string | null | undefined, hasCreative: boolean, cardCount: number): MetaAdType {
  const normalized = displayFormat?.toUpperCase();
  if (normalized === "CAROUSEL") return "carousel";
  if (normalized === "VIDEO") return "video";
  if (normalized === "IMAGE") return "image";
  if (!hasCreative) return "unknown";
  return cardCount > 1 ? "carousel" : "unknown";
}

// Parses one raw {ad_archive_id, snapshot, ...} node (the same shape
// app/lib/services/meta/parseSnapshot.ts resolves for a single ad) into a
// search-result card. Reuses classifyCard so creative-detection logic isn't
// duplicated between the single-ad and search-results paths.
export function parseSearchResultCard(archive: RawAdArchive): MetaSearchResultCard {
  const snapshot = archive.snapshot || {};
  const rawCards = [...(snapshot.cards || []), ...(snapshot.videos || [])];
  if (rawCards.length === 0) {
    rawCards.push({
      video_hd_url: snapshot.video_hd_url,
      video_sd_url: snapshot.video_sd_url,
      video_preview_image_url: snapshot.video_preview_image_url,
      original_image_url: snapshot.original_image_url,
      resized_image_url: snapshot.resized_image_url,
    });
  }

  let thumbnailUrl: string | undefined;
  let videoUrl: string | undefined;
  let creativeKind: MetaCreativeKind | undefined;
  for (const card of rawCards) {
    const classified = classifyCard(card);
    if (!classified) continue;
    creativeKind = classified.kind;
    if (classified.kind === "video" && !videoUrl) {
      videoUrl = classified.url;
      // Meta's own poster frame for this video -- confirmed present on real
      // video cards via a live data capture, read directly since
      // classifyCard only returns the playback kind/url, not the poster.
      if (!thumbnailUrl) thumbnailUrl = firstNonEmptyString(card.video_preview_image_url);
    }
    if (classified.kind === "image" && !thumbnailUrl) thumbnailUrl = classified.url;
  }

  return {
    adArchiveId: archive.ad_archive_id,
    pageId: firstNonEmptyString(snapshot.page_id),
    pageName: firstNonEmptyString(snapshot.page_name),
    pageProfilePictureUrl: firstNonEmptyString(snapshot.page_profile_picture_url),
    isActive: typeof archive.is_active === "boolean" ? archive.is_active : undefined,
    bodyText: firstNonEmptyString(bodyTextOf(snapshot.body), snapshot.link_description),
    headline: firstNonEmptyString(snapshot.title),
    mediaType: mediaTypeFor(snapshot.display_format, !!creativeKind, rawCards.length),
    creativeKind,
    thumbnailUrl,
    videoUrl,
    platforms:
      Array.isArray(archive.publisher_platform) && archive.publisher_platform.length > 0
        ? archive.publisher_platform
        : undefined,
    startDateLabel: formatStartDate(archive),
    startDateMs: startDateMsOf(archive),
  };
}

export function parseSearchResults(raw: unknown): MetaSearchResultCard[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const cards: MetaSearchResultCard[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const archive = entry as RawAdArchive;
    if (typeof archive.ad_archive_id !== "string" || !archive.ad_archive_id) continue;
    if (seen.has(archive.ad_archive_id)) continue;
    seen.add(archive.ad_archive_id);
    cards.push(parseSearchResultCard(archive));
  }
  return cards;
}

// One distinct advertiser found among a batch of real search results --
// never a guess at who might match, only pages that actually have at least
// one matching ad in this batch.
export interface AdvertiserSuggestion {
  pageId?: string;
  pageName: string;
  pageProfilePictureUrl?: string;
  // How many ads in THIS batch belong to them -- a real count from the
  // already-fetched results, not a total across Meta's whole library.
  matchingAdCount: number;
}

// Derives advertiser suggestions from a keyword search's own results,
// rather than calling a separate (undocumented) typeahead endpoint --
// reuses the exact same meta:searchAds data already proven to work, and
// every suggestion is traceable to a real ad this search actually found.
export function extractAdvertiserSuggestions(cards: MetaSearchResultCard[], limit = 8): AdvertiserSuggestion[] {
  const byKey = new Map<string, AdvertiserSuggestion>();
  for (const card of cards) {
    if (!card.pageName) continue;
    const key = card.pageId || `name:${card.pageName.toLowerCase()}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.matchingAdCount += 1;
      if (!existing.pageProfilePictureUrl && card.pageProfilePictureUrl) {
        existing.pageProfilePictureUrl = card.pageProfilePictureUrl;
      }
    } else {
      byKey.set(key, {
        pageId: card.pageId,
        pageName: card.pageName,
        pageProfilePictureUrl: card.pageProfilePictureUrl,
        matchingAdCount: 1,
      });
    }
  }
  return Array.from(byKey.values()).slice(0, limit);
}
