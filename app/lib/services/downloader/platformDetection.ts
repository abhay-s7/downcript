// Cosmetic-only platform badge, ported from Downly's detectPlatform() —
// it never gates behavior (yt-dlp does its own site routing internally), it
// just labels the queue card so the user can tell sources apart at a glance.
const PLATFORM_PATTERNS: Array<[RegExp, string]> = [
  [/youtube|youtu\.be/, "YouTube"],
  [/tiktok/, "TikTok"],
  [/instagram/, "Instagram"],
  [/twitter|x\.com/, "Twitter/X"],
  [/reddit/, "Reddit"],
  [/facebook|fb\.watch/, "Facebook"],
  [/vimeo/, "Vimeo"],
  [/twitch/, "Twitch"],
  [/soundcloud/, "SoundCloud"],
  [/dailymotion/, "Dailymotion"],
  [/pinterest/, "Pinterest"],
  [/tumblr/, "Tumblr"],
  [/threads\.net/, "Threads"],
  [/linkedin/, "LinkedIn"],
  [/loom\.com/, "Loom"],
  [/streamable/, "Streamable"],
];

export function detectPlatform(url: string): string {
  let hostname: string;
  try {
    hostname = new URL(url.trim()).hostname.replace(/^www\./, "");
  } catch {
    return "Unknown";
  }

  for (const [pattern, label] of PLATFORM_PATTERNS) {
    if (pattern.test(hostname)) return label;
  }

  const secondLevel = hostname.split(".").slice(-2)[0] || hostname;
  return secondLevel.charAt(0).toUpperCase() + secondLevel.slice(1);
}
