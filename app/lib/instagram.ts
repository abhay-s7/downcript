const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com", "m.instagram.com"]);

export function extractInstagramReelId(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase();
    if (!INSTAGRAM_HOSTS.has(host)) return null;

    const match = parsed.pathname.match(/^\/(?:reel|reels|p|tv)\/([^/?]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
