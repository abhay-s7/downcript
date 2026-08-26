const DAILYMOTION_HOSTS = new Set([
  "dailymotion.com",
  "www.dailymotion.com",
  "touch.dailymotion.com",
]);
const DAILYMOTION_SHORT_HOSTS = new Set(["dai.ly"]);

export function extractDailymotionVideoId(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase();

    if (DAILYMOTION_SHORT_HOSTS.has(host)) {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }

    if (!DAILYMOTION_HOSTS.has(host)) return null;

    const match = parsed.pathname.match(/^\/(?:embed\/)?video\/([^/_?]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
