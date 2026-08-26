// yt-dlp's own textual progress output, parsed the same way regardless of
// which source is being downloaded (this logic was originally written for
// Dailymotion but is not Dailymotion-specific — it just parses yt-dlp's
// universal "[download] X% of ~YMiB at ZMiB/s ETA W" stdout format).
export interface YtDlpProgress {
  percent: number;
  downloadedBytes?: number;
  totalBytes?: number;
  speedBytesPerSec?: number;
  etaSeconds?: number;
}

const SIZE_UNITS: Record<string, number> = { B: 1, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3 };

function parseSize(value: string, unit: string): number | undefined {
  const bytesPerUnit = SIZE_UNITS[unit];
  if (bytesPerUnit === undefined) return undefined;
  return parseFloat(value) * bytesPerUnit;
}

// "12:34" (mm:ss) or "01:02:03" (hh:mm:ss) -> seconds.
function parseEta(value: string): number | undefined {
  const parts = value.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return undefined;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

// Matches lines like: "[download]  68.0% of ~ 267.45MiB at 6.22MiB/s ETA 00:08 (frag 1307/1595)"
export function parseYtDlpProgressLine(line: string): YtDlpProgress | null {
  const percentMatch = line.match(/^\[download\]\s+([\d.]+)%/);
  if (!percentMatch) return null;

  const percent = parseFloat(percentMatch[1]);
  const sizeMatch = line.match(/of\s+~?\s*([\d.]+)\s*(B|KiB|MiB|GiB)/i);
  const speedMatch = line.match(/at\s+([\d.]+)\s*(B|KiB|MiB|GiB)\/s/i);
  const etaMatch = line.match(/ETA\s+(\d+(?::\d+){1,2})/);

  const totalBytes = sizeMatch ? parseSize(sizeMatch[1], sizeMatch[2]) : undefined;
  const speedBytesPerSec = speedMatch ? parseSize(speedMatch[1], speedMatch[2]) : undefined;
  const etaSeconds = etaMatch ? parseEta(etaMatch[1]) : undefined;
  const downloadedBytes = totalBytes !== undefined ? Math.round(totalBytes * (percent / 100)) : undefined;

  return { percent, downloadedBytes, totalBytes, speedBytesPerSec, etaSeconds };
}
