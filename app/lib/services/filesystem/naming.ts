// Shared filename rules used everywhere a job (transcript export, download,
// Meta ad creative, ...) turns into a real file on disk -- the one place
// that decides what's safe on both macOS and Windows, and (via
// buildMediaBaseName below) how a title/creator/platform combine into the
// name itself, so every module builds names the same way instead of each
// re-inventing its own string-joining.

// Windows reserves these names outright, with or without an extension --
// matched against the sanitized base alone (checked below), since every
// caller re-appends its own extension afterward anyway.
const RESERVED_WINDOWS_NAMES = /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$/i;

// Generous but bounded -- comfortably under every real filesystem limit
// (NTFS/APFS/ExFAT all allow 255 UTF-16 units per component) with headroom
// left for a dedupe suffix like " (1)" or a Meta carousel's " - Creative 01".
const MAX_BASENAME_LENGTH = 150;

const CONTROL_CHARS_RE = new RegExp("[\\u0000-\\u001F\\u007F]", "g");

function stripControlChars(s: string): string {
  return s.replace(CONTROL_CHARS_RE, "");
}

// Truncates by Unicode grapheme cluster, not raw UTF-16 code units or code
// points alone -- a naive .slice(0, n) can land in the middle of a surrogate
// pair (most emoji) or split a combined sequence (flag emoji, ZWJ family
// emoji), producing a mangled/invalid tail. Intl.Segmenter (available in
// both Electron's renderer and Node 20+, which this app already requires)
// walks whole grapheme clusters instead.
function truncateGraphemeSafe(s: string, maxLength: number): string {
  if (s.length <= maxLength) return s; // already short enough by the cheaper measure
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    let result = "";
    for (const { segment } of segmenter.segment(s)) {
      if (result.length + segment.length > maxLength) break;
      result += segment;
    }
    return result.trimEnd();
  }
  // Fallback: iterate by code point (via the string iterator) -- still
  // correctly keeps surrogate pairs together, just not multi-codepoint
  // grapheme clusters, in the unlikely case Intl.Segmenter is unavailable.
  let result = "";
  for (const ch of s) {
    if (result.length + ch.length > maxLength) break;
    result += ch;
  }
  return result.trimEnd();
}

// Strips a file extension and any character illegal in a Windows or macOS
// filename, so the same sanitized name is safe on both target platforms --
// also handles control characters, a trailing dot/space (Windows-invalid),
// a leading dot (would silently create a hidden file on macOS/Linux),
// Windows' reserved device names, and safe length capping.
export function sanitizeFileBaseName(name: string, maxLength = MAX_BASENAME_LENGTH): string {
  const withoutExtension = name.replace(/\.[^/.]+$/, "");
  let sanitized = stripControlChars(withoutExtension).replace(/[\\/:*?"<>|]/g, "_").trim();
  sanitized = truncateGraphemeSafe(sanitized, maxLength);
  // Re-checked after truncation, since cutting the string can newly expose
  // a trailing dot/space or leading dot at the new boundary.
  sanitized = sanitized.replace(/[\s.]+$/, "").replace(/^\.+/, "");

  if (!sanitized) return "file";
  if (RESERVED_WINDOWS_NAMES.test(sanitized)) return `${sanitized}_`;
  return sanitized;
}

export function sanitizePathSegment(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "file";
}

// The three fixed presets this app offers (see
// app/lib/services/settings/namingPreference.ts) -- deliberately not a
// free-form user template, to keep this simple.
export type NamingTemplate = "title" | "creator-title" | "creator-title-platform";

export interface MediaNameParts {
  title: string;
  creator?: string;
  platform?: string;
}

// Assembles "Creator - Title[- Platform]" per `template`, then sanitizes the
// WHOLE combined string at once (not each part separately) -- so the length
// cap and reserved-name check apply to what actually becomes the filename.
// Related outputs (a video and its transcript/subtitle) are meant to call
// this with the same parts and just swap the extension afterward, so they
// share one base name with no extra suffix -- e.g. so a .srt with the same
// base as its .mp4 gets auto-picked-up by most video players.
export function buildMediaBaseName(parts: MediaNameParts, template: NamingTemplate): string {
  const title = parts.title.trim() || "Untitled";
  const segments: string[] = [];

  if (template !== "title" && parts.creator?.trim()) {
    segments.push(parts.creator.trim());
  }
  segments.push(title);
  if (template === "creator-title-platform" && parts.platform?.trim()) {
    segments.push(parts.platform.trim());
  }

  return sanitizeFileBaseName(segments.join(" - "));
}
