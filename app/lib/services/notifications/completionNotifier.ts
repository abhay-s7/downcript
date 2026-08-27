// Fires exactly once per logical completed task, called imperatively from
// the exact code path that just determined a task succeeded (in the queue
// hooks' worker loops) -- never from a useEffect watching state, so there's
// no risk of re-firing on an unrelated re-render or HMR refresh.
//
// Two independent delivery mechanisms, both gated by the same "Completion
// Sound" setting:
// 1. A short bundled chime, played here in the renderer (works even when
//    the window is unfocused -- Electron doesn't mute background windows).
// 2. A native OS notification via the main process (see electron/main.js),
//    shown *silent* so it never doubles up with the chime above -- it's a
//    purely visual "still ran even if you weren't looking at the window"
//    backstop, not a second sound source.
const STORAGE_KEY = "downcript:completionSoundEnabled";
const SOUND_SRC = "/sounds/task-complete.wav";

function readStoredEnabled(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "true"; // default ON
  } catch {
    return true;
  }
}

let enabledCache: boolean | null = null;

// Read by both Settings (to render the checkbox) and the queue hooks (to
// decide whether to actually play anything) -- a plain module-level cache
// rather than a React hook, since the queue hooks call this from inside
// imperative worker-loop code, not component render bodies.
export function isCompletionSoundEnabled(): boolean {
  if (enabledCache === null) enabledCache = readStoredEnabled();
  return enabledCache;
}

export function setCompletionSoundEnabled(value: boolean): void {
  enabledCache = value;
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Private-browsing-style storage block -- the in-memory cache above
    // still makes the toggle work for the rest of this session.
  }
}

let audioEl: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio(SOUND_SRC);
    audioEl.volume = 0.5;
  }
  return audioEl;
}

export function notifyTaskComplete(message?: string): void {
  if (!isCompletionSoundEnabled()) return;

  try {
    const el = getAudio();
    el.currentTime = 0;
    void el.play().catch(() => {
      // Browser autoplay policies or similar transient failures -- not
      // worth surfacing an error for a "nice to have" completion chime.
    });
  } catch {
    // Audio API unavailable in this context -- no-op.
  }

  if (typeof window !== "undefined" && window.desktop?.notifyTaskComplete) {
    window.desktop.notifyTaskComplete(message || "Task completed successfully.").catch(() => {});
  }
}
