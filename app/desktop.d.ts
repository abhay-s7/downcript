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
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}
