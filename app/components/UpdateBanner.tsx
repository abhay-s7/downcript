"use client";

import { useState } from "react";
import { useAppUpdater } from "@/app/hooks/useAppUpdater";

function formatMBps(bytesPerSecond?: number): string {
  if (!bytesPerSecond) return "";
  return ` (${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s)`;
}

// Desktop-only, same as ModelSetupBanner -- renders nothing at all in a
// plain browser tab, and nothing in dev (electron/autoUpdater.js never
// broadcasts any state other than the "not-available" default there).
export default function UpdateBanner() {
  const { state, hasActiveJobs, downloadUpdate, quitAndInstall } = useAppUpdater();
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [confirmingWithActiveJobs, setConfirmingWithActiveJobs] = useState(false);

  if (state.status === "checking" || state.status === "not-available") return null;
  if (state.status === "available" && dismissedFor === `available:${state.version}`) return null;
  if (state.status === "downloaded" && dismissedFor === `downloaded:${state.version}`) return null;
  if (state.status === "error" && dismissedFor === "error") return null;

  function handleRestartClick() {
    if (hasActiveJobs && !confirmingWithActiveJobs) {
      setConfirmingWithActiveJobs(true);
      return;
    }
    quitAndInstall();
  }

  return (
    <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
      {state.status === "available" && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-blue-800">
            New version available{state.version ? ` — v${state.version}` : ""}.
          </p>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={downloadUpdate}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              Update Now
            </button>
            <button
              onClick={() => setDismissedFor(`available:${state.version}`)}
              className="text-xs text-blue-600 hover:underline"
            >
              Later
            </button>
          </div>
        </div>
      )}

      {state.status === "downloading" && (
        <div className="space-y-2">
          <p className="text-blue-800">
            Downloading update{state.percent !== undefined ? ` — ${Math.round(state.percent)}%` : ""}
            {formatMBps(state.bytesPerSecond)}... The app stays fully usable while this finishes in
            the background.
          </p>
          {state.percent !== undefined && (
            <div className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-blue-200">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${Math.min(100, Math.round(state.percent))}%` }}
              />
            </div>
          )}
        </div>
      )}

      {state.status === "downloaded" && (
        <div className="space-y-2">
          <p className="text-blue-800">
            Update ready{state.version ? ` — v${state.version}` : ""}.{" "}
            {hasActiveJobs
              ? "Restart when your current tasks are complete, or restart now anyway."
              : "Restart to install it."}
          </p>

          {confirmingWithActiveJobs ? (
            <div className="flex items-center gap-3">
              <span className="text-blue-800">
                You still have downloads or transcriptions running — restart and install anyway?
              </span>
              <button
                onClick={quitAndInstall}
                className="flex-shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
              >
                Restart Anyway
              </button>
              <button
                onClick={() => setConfirmingWithActiveJobs(false)}
                className="flex-shrink-0 text-xs text-blue-600 hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleRestartClick}
                className="flex-shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                Restart &amp; Install
              </button>
              <button
                onClick={() => setDismissedFor(`downloaded:${state.version}`)}
                className="flex-shrink-0 text-xs text-blue-600 hover:underline"
              >
                Later
              </button>
            </div>
          )}
        </div>
      )}

      {state.status === "error" && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-red-700">Update check failed: {state.error}</p>
          <button onClick={() => setDismissedFor("error")} className="flex-shrink-0 text-xs text-red-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
