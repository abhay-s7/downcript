"use client";

import { useEffect, useState } from "react";
import { ModelProgressEvent } from "@/app/desktop";

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
    <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
      {status === "checking" && (
        <p className="text-blue-800">Checking local transcription setup...</p>
      )}

      {status === "downloading" && (
        <div className="space-y-2">
          <p className="text-blue-800">
            Setting up local transcription (one-time download
            {progress?.model ? ` — ${progress.model} model` : ""})...
          </p>
          {pct !== null && (
            <div className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-blue-200">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          {pct !== null && progress?.total && (
            <p className="text-xs text-blue-600">
              {formatMB(progress.downloaded ?? 0)}MB / {formatMB(progress.total)}MB ({pct}%)
            </p>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-red-700">Local transcription setup failed: {error}</p>
          <button
            onClick={retry}
            className="shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
