"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "downcript:outputDir";

// Shared across Download, Meta Ads, and Settings so changing the default in
// one place actually takes effect everywhere else, instead of each panel
// tracking its own local copy of "the" default (which Settings' picker would
// otherwise have no way to actually influence). Panels aren't mounted
// simultaneously in this app's single-section-at-a-time layout, so each one
// re-reading from localStorage on its own mount is enough to stay in sync --
// no need for a live cross-component store.
export function useOutputDir() {
  const [outputDir, setOutputDirState] = useState<string | undefined>(undefined);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    void (async () => {
      setIsDesktop(true);
      const stored = localStorage.getItem(STORAGE_KEY);
      setOutputDirState(stored || (await desktop.defaultDownloadDir()));
    })();
  }, []);

  const setOutputDir = useCallback((dir: string) => {
    setOutputDirState(dir);
    try {
      localStorage.setItem(STORAGE_KEY, dir);
    } catch {
      // Private-browsing-style storage block -- the in-memory value from
      // setOutputDirState above still works for the rest of this session.
    }
  }, []);

  const chooseFolder = useCallback(async () => {
    if (!window.desktop) return;
    const chosen = await window.desktop.chooseFolder();
    if (chosen) setOutputDir(chosen);
  }, [setOutputDir]);

  return { outputDir, isDesktop, setOutputDir, chooseFolder };
}
