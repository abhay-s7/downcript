import { LibraryEntry, LibraryEntryInput } from "@/app/lib/services/library/types";
import { MetaSearchResultCard } from "@/app/lib/services/meta/parseSearchResults";

export interface ModelCheckResult {
  missing: string[];
}

export interface ModelProgressEvent {
  type: "model-cached" | "model-start" | "progress" | "model-done" | "model-error" | "all-done";
  model?: string;
  downloaded?: number;
  total?: number;
  error?: string;
}

// Mirrors one entry in electron/main.js's bookmarkEntries array -- the full
// ad card (as already resolved by meta:searchAds) plus the Meta Ad Library
// link and when it was saved, so the Bookmarked Ads view can render a
// complete card without a live re-fetch.
export interface BookmarkedAd extends MetaSearchResultCard {
  url: string;
  savedAt: number;
}

// Mirrors electron/autoUpdater.js's broadcast shape exactly -- one flat
// discriminated-by-status object rather than separate events, so the
// renderer only ever has one piece of state to reconcile.
export interface UpdaterState {
  status: "checking" | "not-available" | "available" | "downloading" | "downloaded" | "error";
  version?: string;
  releaseNotes?: string;
  percent?: number;
  bytesPerSecond?: number;
  transferred?: number;
  total?: number;
  error?: string;
}

export interface DesktopBridge {
  isElectron: true;
  platform: string;
  models: {
    check: () => Promise<ModelCheckResult>;
    ensure: () => Promise<{ ok: true }>;
    onProgress: (callback: (event: ModelProgressEvent) => void) => () => void;
  };
  chooseFolder: () => Promise<string | null>;
  defaultDownloadDir: () => Promise<string>;
  openLogsFolder: () => Promise<void>;
  notifyTaskComplete: (message?: string) => Promise<void>;
  // Ads bookmarked from the native Competitor Ad Research grid, persisted by
  // the main process (electron/main.js's bookmarkEntries).
  bookmarks: {
    list: () => Promise<BookmarkedAd[]>;
    toggle: (payload: { adArchiveId: string; url: string } & Partial<MetaSearchResultCard>) => Promise<boolean>;
    remove: (adArchiveId: string) => Promise<BookmarkedAd[]>;
    onChanged: (callback: (entries: BookmarkedAd[]) => void) => () => void;
  };
  // Raw parsed JSON from the ad's embedded data-sjs script -- shape is
  // whatever Meta's Relay preload cache happens to contain, deliberately
  // untyped here; app/lib/services/meta does the shape search and validation.
  resolveMetaAd: (url: string) => Promise<unknown>;
  // Competitor Ad Research: raw ad-archive-shaped JSON nodes found on a
  // search results page -- deliberately untyped here, same reasoning as
  // resolveMetaAd; app/lib/services/meta/parseSearchResults.ts does the
  // real parsing into MetaSearchResultCard. Only ever the first batch Meta's
  // page renders server-side -- see searchMetaAdsSession for the rest.
  searchMetaAds: (url: string) => Promise<unknown[]>;
  // Pagination beyond the first batch -- see the matching bridge's comment
  // in electron/preload.js for what each verb does.
  searchMetaAdsSession: {
    start: (url: string) => Promise<{ sessionId: string }>;
    more: (sessionId: string) => Promise<{ ads: unknown[] }>;
    stop: (sessionId: string) => Promise<void>;
  };
  library: {
    list: () => Promise<LibraryEntry[]>;
    upsert: (entry: LibraryEntryInput) => Promise<LibraryEntry>;
    remove: (id: string, options?: { deleteFile?: boolean }) => Promise<void>;
    rename: (id: string, newBaseName: string) => Promise<LibraryEntry>;
    openFile: (filePath: string) => Promise<string>;
    openFolder: (filePath: string) => Promise<void>;
    scanFolders: (folders: string[]) => Promise<{ added: number }>;
    onChanged: (callback: (entries: LibraryEntry[]) => void) => () => void;
  };
  updater: {
    checkNow: () => Promise<void>;
    downloadUpdate: () => Promise<void>;
    quitAndInstall: () => Promise<void>;
    onState: (callback: (state: UpdaterState) => void) => () => void;
  };
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}
