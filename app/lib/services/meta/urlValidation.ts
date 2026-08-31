// Fast, pure, client-side checks for the batch input's preview step -- lets
// a paste of dozens of lines be classified instantly (valid/duplicate/
// invalid/unsupported) without spawning a hidden BrowserWindow per line just
// to discover most of them aren't Meta URLs. Deliberately duplicated from
// (not imported from) electron/main.js's own looser extractMetaAdId, which
// only checks for an `id` param and doesn't gate on hostname at all -- that
// stays as-is for the single-URL flow it already serves; this is stricter
// specifically so the batch preview can tell "not a Facebook link at all"
// apart from "a Facebook link with no ad id", which the existing single-URL
// error message doesn't need to (it only ever gets one candidate at a time).
export function isMetaHost(url: string): boolean {
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return host.includes("facebook.com") || host.includes("fb.watch");
  } catch {
    return false;
  }
}

export function extractMetaAdId(url: string): string | null {
  try {
    return new URL(url.trim()).searchParams.get("id");
  } catch {
    return null;
  }
}
