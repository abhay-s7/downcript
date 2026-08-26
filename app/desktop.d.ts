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
  // Raw parsed JSON from the ad's embedded data-sjs script -- shape is
  // whatever Meta's Relay preload cache happens to contain, deliberately
  // untyped here; app/lib/services/meta does the shape search and validation.
  resolveMetaAd: (url: string) => Promise<unknown>;
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}
