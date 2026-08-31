import { extractMetaAdId, isMetaHost } from "@/app/lib/services/meta/urlValidation";

export type BatchUrlStatus = "valid" | "duplicate" | "invalid" | "unsupported";

export interface BatchUrlEntry {
  raw: string;
  status: BatchUrlStatus;
  adId?: string;
  reason?: string;
}

const URL_TOKEN_RE = /^https?:\/\/\S+$/i;

// Splits on any run of whitespace or commas -- covers newline-separated
// paste, space-separated paste (a bare URL never legitimately contains an
// unencoded space, so this is always safe), and a plain TXT/CSV import (one
// URL per line, or comma-separated) without needing a real CSV parser.
export function tokenizeBatchInput(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

// existingAdIds: ad ids already present in the live queue (see
// MetaAdBatchInput.tsx for how these are derived from each queued group's
// own original URL) -- catches a re-paste of something already queued, not
// just duplicates within this one paste.
export function classifyBatchInput(text: string, existingAdIds: ReadonlySet<string>): BatchUrlEntry[] {
  const seenInBatch = new Set<string>();
  const entries: BatchUrlEntry[] = [];

  for (const raw of tokenizeBatchInput(text)) {
    if (!URL_TOKEN_RE.test(raw)) {
      entries.push({ raw, status: "invalid", reason: "Not a valid URL." });
      continue;
    }
    if (!isMetaHost(raw)) {
      entries.push({ raw, status: "unsupported", reason: "Not a Meta Ad Library link." });
      continue;
    }

    const adId = extractMetaAdId(raw);
    if (!adId) {
      entries.push({ raw, status: "invalid", reason: "Missing an ad id (?id=...) in the link." });
      continue;
    }
    if (seenInBatch.has(adId) || existingAdIds.has(adId)) {
      entries.push({ raw, status: "duplicate", adId, reason: "Already in this batch or already queued." });
      continue;
    }

    seenInBatch.add(adId);
    entries.push({ raw, status: "valid", adId });
  }

  return entries;
}
