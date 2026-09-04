// A tiny cross-component signal for "is anything actually running right
// now" -- each of the three queue hooks (Download/Transcript/Meta Ads) is
// instantiated inside its own panel, with no shared parent state, so a
// top-level component (the update banner, deciding whether to warn before
// "Restart & Install") has no other way to see their combined busy state
// without lifting all three hooks up to page.tsx -- a much bigger change
// than this needs. A plain module-level pub/sub is enough for a single
// boolean-ish signal like this.
type Listener = (activeCount: number) => void;

const activeSources = new Map<string, boolean>();
const listeners = new Set<Listener>();

function notify() {
  const count = getActiveCount();
  for (const listener of listeners) listener(count);
}

export function setSourceActive(sourceKey: string, active: boolean): void {
  const was = activeSources.get(sourceKey) ?? false;
  if (was === active) return;
  activeSources.set(sourceKey, active);
  notify();
}

export function getActiveCount(): number {
  let count = 0;
  for (const active of activeSources.values()) {
    if (active) count += 1;
  }
  return count;
}

export function subscribeActive(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
