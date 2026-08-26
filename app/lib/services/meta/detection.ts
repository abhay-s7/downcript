// Pure string logic, no runtime dependencies -- safe to import from either
// client or server code, same convention as platformDetection.ts.
export function isMetaAdLibraryUrl(url: string): boolean {
  try {
    const hostname = new URL(url.trim()).hostname.replace(/^www\./, "");
    return (hostname === "facebook.com" || hostname === "fb.com") && url.includes("/ads/library");
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
