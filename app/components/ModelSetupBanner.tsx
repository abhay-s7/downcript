"use client";

import { useEffect, useState } from "react";
import { ModelProgressEvent } from "@/app/desktop";
import { BANNER_INFO, BANNER_INFO_TEXT, BANNER_PROGRESS_TRACK, BANNER_PROGRESS_FILL } from "@/app/lib/uiStyles";

type Status = "idle" | "checking" | "downloading" | "error" | "done";

function formatMB(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(0);
}

// Desktop-only: the packaged app has no system Python/Whisper, so the local
// transcription models are downloaded once on first launch instead of being
// baked into the installer. Renders nothing at all on the web app, since
// window.desktop only exists inside Electron.
export default function ModelSetupBanner() {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState<ModelProgressEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;

    let cancelled = false;
    const unsubscribe = desktop.models.onProgress((event) => {
      if (cancelled) return;
      setProgress(event);
    });

    async function run() {
      setStatus("checking");
      try {
        const { missing } = await desktop!.models.check();
        if (cancelled) return;
        if (missing.length === 0) {
          setStatus("done");
          return;
        }
        setStatus("downloading");
        await desktop!.models.ensure();
        if (cancelled) return;
        setStatus("done");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Model setup failed.");
        setStatus("error");
      }
    }
    run();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  function retry() {
    setError(null);
    setStatus("downloading");
    window.desktop?.models
      .ensure()
      .then(() => setStatus("done"))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Model setup failed.");
        setStatus("error");
      });
  }

  if (status === "idle" || status === "done") return null;

  const pct =
    progress?.type === "progress" && progress.total
      ? Math.min(100, Math.round(((progress.downloaded ?? 0) / progress.total) * 100))
      : null;

  return (
    <div className={BANNER_INFO}>
      {status === "checking" && (
        <p className={BANNER_INFO_TEXT}>Checking local transcription setup...</p>
      )}

      {status === "downloading" && (
        <div className="space-y-2.5">
          <p className={BANNER_INFO_TEXT}>
            Setting up local transcription (one-time download
            {progress?.model ? ` — ${progress.model} model` : ""})...
          </p>
          {pct !== null && (
            <div className={BANNER_PROGRESS_TRACK}>
              <div className={BANNER_PROGRESS_FILL} style={{ width: `${pct}%` }} />
            </div>
          )}
          {pct !== null && progress?.total && (
            <p className="text-xs text-text-2 font-mono">
              {formatMB(progress.downloaded ?? 0)}MB / {formatMB(progress.total)}MB ({pct}%)
            </p>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-danger">Local transcription setup failed: {error}</p>
          <button
            onClick={retry}
            className="shrink-0 rounded-[9px] bg-danger px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 transition-[filter]"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
