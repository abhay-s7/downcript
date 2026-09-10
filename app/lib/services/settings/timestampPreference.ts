// Whether new transcription jobs include [HH:MM:SS] timestamps by default.
// localStorage-backed module cache, same pattern as downloadConcurrency.ts/
// namingPreference.ts -- read imperatively from TranscriptPanel when a job
// is created, not just from a component render body.
const STORAGE_KEY = "downcript:includeTimestamps";
const DEFAULT_INCLUDE_TIMESTAMPS = false;

function readStored(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
    return DEFAULT_INCLUDE_TIMESTAMPS;
  } catch {
    return DEFAULT_INCLUDE_TIMESTAMPS;
  }
}

let cache: boolean | null = null;

export function getIncludeTimestamps(): boolean {
  if (cache === null) cache = readStored();
  return cache;
}

export function setIncludeTimestamps(value: boolean): void {
  cache = value;
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Private-browsing-style storage block -- the in-memory cache still
    // makes the setting work for the rest of this session.
  }
}
