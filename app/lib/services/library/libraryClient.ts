import { LibraryEntryInput } from "@/app/lib/services/library/types";

// Fire-and-forget, same style as notifyTaskComplete -- called from inside
// the download/meta queue hooks' existing completion/failure branches, never
// worth blocking or failing that critical path over a non-essential library
// registration. window.desktop is absent in a plain browser tab (dev-only);
// silently a no-op there, same as every other desktop-only feature.
export function registerLibraryEntry(input: LibraryEntryInput): void {
  window.desktop?.library.upsert(input).catch(() => {
    // Non-essential bookkeeping -- the source file/queue state is
    // unaffected either way.
  });
}
