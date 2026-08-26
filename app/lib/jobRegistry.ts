// In-memory registry mapping a client-generated job ID to the cancel
// callbacks for whatever is currently running on its behalf (a child
// process, a fetch AbortController, ...). This is a local MVP running as a
// single Node process, so a module-level Map is sufficient — no Redis or
// external job service needed to let a "Cancel Processing" click actually
// stop the in-flight FFmpeg/Whisper work for that job.
const registry = new Map<string, Set<() => void>>();

export function registerCanceler(jobId: string, cancel: () => void): () => void {
  let cancelers = registry.get(jobId);
  if (!cancelers) {
    cancelers = new Set();
    registry.set(jobId, cancelers);
  }
  cancelers.add(cancel);

  return () => {
    const current = registry.get(jobId);
    if (!current) return;
    current.delete(cancel);
    if (current.size === 0) registry.delete(jobId);
  };
}

export function killJob(jobId: string): boolean {
  const cancelers = registry.get(jobId);
  if (!cancelers || cancelers.size === 0) return false;
  for (const cancel of cancelers) cancel();
  registry.delete(jobId);
  return true;
}
