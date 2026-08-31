import { LibraryEntry, LibraryEntryInput } from "@/app/lib/services/library/types";

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
  // Raw parsed JSON from the ad's embedded data-sjs script -- shape is
  // whatever Meta's Relay preload cache happens to contain, deliberately
  // untyped here; app/lib/services/meta does the shape search and validation.
  resolveMetaAd: (url: string) => Promise<unknown>;
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
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}
