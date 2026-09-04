"use client";

import { useCallback, useEffect, useState } from "react";
import { UpdaterState } from "@/app/desktop";
import { getActiveCount, subscribeActive } from "@/app/lib/services/activity/activeJobTracker";

// Thin wrapper around window.desktop.updater -- mirrors ModelSetupBanner's
// shape (subscribe to a main-process broadcast, expose plain state), plus
// the one thing that's genuinely this hook's own concern: whether it's
// currently safe to install without warning, which nothing else in the
// main process can answer since job state lives entirely in the renderer's
// three separate queue hooks.
export function useAppUpdater() {
  const [state, setState] = useState<UpdaterState>({ status: "not-available" });
  const [activeJobCount, setActiveJobCount] = useState(() => getActiveCount());

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    return desktop.updater.onState(setState);
  }, []);

  useEffect(() => subscribeActive(setActiveJobCount), []);

  const downloadUpdate = useCallback(() => {
    void window.desktop?.updater.downloadUpdate();
  }, []);

  // The confirmation step itself is left to the UI component (which knows
  // how to render a "you have active tasks" dialog) -- this just exposes
  // whether one is warranted, and the actual quitAndInstall call.
  const quitAndInstall = useCallback(() => {
    void window.desktop?.updater.quitAndInstall();
  }, []);

  return {
    state,
    hasActiveJobs: activeJobCount > 0,
    downloadUpdate,
    quitAndInstall,
  };
}
