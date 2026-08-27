// How many downloads useDownloadQueue will run at once. A plain
// localStorage-backed module cache, same pattern as completionNotifier.ts --
// read imperatively from inside the queue's worker-lane logic, not just from
// component render bodies, so it can't be a React hook.
const STORAGE_KEY = "downcript:maxConcurrentDownloads";
const DEFAULT_CONCURRENCY = 2;
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 4; // small and deliberate -- not "unlimited processes"

function clamp(value: number): number {
  return Math.min(MAX_CONCURRENCY, Math.max(MIN_CONCURRENCY, Math.round(value)));
}

function readStored(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored === null ? NaN : Number(stored);
    return Number.isFinite(parsed) ? clamp(parsed) : DEFAULT_CONCURRENCY;
  } catch {
    return DEFAULT_CONCURRENCY;
  }
}

let cache: number | null = null;

export function getMaxConcurrentDownloads(): number {
  if (cache === null) cache = readStored();
  return cache;
}

export function setMaxConcurrentDownloads(value: number): void {
  cache = clamp(value);
  try {
    localStorage.setItem(STORAGE_KEY, String(cache));
  } catch {
    // Private-browsing-style storage block -- the in-memory cache still
    // makes the setting work for the rest of this session.
  }
}

export const CONCURRENCY_OPTIONS = Array.from(
  { length: MAX_CONCURRENCY - MIN_CONCURRENCY + 1 },
  (_, i) => MIN_CONCURRENCY + i
);
