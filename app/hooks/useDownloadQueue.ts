"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelDownloadJobOnServer,
  createDownloadCard,
  DownloadCard,
  DownloadCardStatus,
  DownloadFormatSelection,
  fetchMediaInfoForCard,
  loadDownloadQueue,
  runDownloadJob,
  saveDownloadQueue,
} from "@/app/lib/downloadJobs";
import { getMaxConcurrentDownloads } from "@/app/lib/services/settings/downloadConcurrency";
import { notifyTaskComplete } from "@/app/lib/services/notifications/completionNotifier";
import { registerLibraryEntry } from "@/app/lib/services/library/libraryClient";
import { kindForExtension } from "@/app/lib/services/library/types";

const ACTIVE_STATUSES: DownloadCardStatus[] = ["preparing", "downloading", "processing"];

// A small pool of concurrent "lanes" (see runLane below) rather than one
// sequential worker -- each lane loops claiming the next queued card until
// none remain, so up to getMaxConcurrentDownloads() run in parallel without
// interfering with each other (each has its own AbortController, keyed by
// card id in activeControllersRef, instead of the single shared ref a
// one-at-a-time worker could get away with).
export function useDownloadQueue() {
  const cardsRef = useRef<DownloadCard[]>([]);
  const [cards, setCards] = useState<DownloadCard[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const runningLanesRef = useRef(0);
  const activeControllersRef = useRef<Map<string, AbortController>>(new Map());
  // Set just before aborting a controller for a *pause* -- the worker
  // lane's catch block checks this to label the outcome "paused" instead of
  // "cancelled" (both surface as the same AbortSignal from fetch's point of
  // view, so the distinction has to be tracked out-of-band like this).
  const pausedIntentRef = useRef<Set<string>>(new Set());
  const outputDirRef = useRef<string | undefined>(undefined);

  const sync = useCallback(() => {
    setCards([...cardsRef.current]);
    saveDownloadQueue(cardsRef.current);
  }, []);

  const updateCard = useCallback(
    (id: string, patch: Partial<DownloadCard>) => {
      cardsRef.current = cardsRef.current.map((c) => (c.id === id ? { ...c, ...patch } : c));
      sync();
    },
    [sync]
  );

  const setOutputDir = useCallback((dir: string | undefined) => {
    outputDirRef.current = dir;
  }, []);

  // Restores whatever was persisted from a previous session, once, on
  // mount -- deliberately not the useState initializer, since localStorage
  // isn't available during server rendering and reading it there would
  // desync from the client's hydrated output.
  useEffect(() => {
    // Deferred a tick (rather than calling setCards synchronously in the
    // effect body) purely to satisfy react-hooks/set-state-in-effect --
    // there's no actual async work here, just a one-time localStorage read.
    void Promise.resolve().then(() => {
      const restored = loadDownloadQueue();
      if (restored.length > 0) {
        cardsRef.current = restored;
        setCards(restored);
      }
    });
  }, []);

  function claimNext(): DownloadCard | null {
    const next = cardsRef.current.find((c) => c.status === "queued");
    if (!next) return null;
    cardsRef.current = cardsRef.current.map((c) =>
      c.id === next.id ? { ...c, status: "preparing" as const, error: undefined, progress: undefined } : c
    );
    sync();
    return cardsRef.current.find((c) => c.id === next.id) ?? null;
  }

  async function runLane() {
    runningLanesRef.current += 1;
    setIsProcessing(true);

    try {
      while (true) {
        const card = claimNext();
        if (!card) break;

        const controller = new AbortController();
        activeControllersRef.current.set(card.id, controller);

        try {
          // A job that already attempted once (paused, retried, or resumed
          // after an app restart) keeps targeting the exact folder it
          // started in, so yt-dlp's own partial-file continuation lands on
          // the same destination instead of a Settings change mid-flight
          // silently redirecting it to a fresh, empty file.
          const targetOutputDir = card.destinationDir ?? outputDirRef.current;
          const result = await runDownloadJob(card, targetOutputDir, controller.signal, (patch) =>
            updateCard(card.id, patch)
          );
          updateCard(card.id, { status: "completed", filePath: result.filePath, fileName: result.fileName });
          notifyTaskComplete(`${result.fileName} finished downloading.`);

          const ext = result.fileName.split(".").pop() || "";
          registerLibraryEntry({
            id: card.id,
            filePath: result.filePath,
            fileName: result.fileName,
            title: card.title || card.platform,
            sourceModule: "download",
            platform: card.platform,
            sourceUrl: card.url,
            kind: kindForExtension(ext),
            ext,
            durationSeconds: card.duration,
            status: "completed",
            thumbnail: card.thumbnail,
          });
        } catch (err) {
          if (controller.signal.aborted) {
            const wasPause = pausedIntentRef.current.delete(card.id);
            updateCard(card.id, { status: wasPause ? "paused" : "cancelled" });
          } else {
            const message = err instanceof Error ? err.message : "Download failed.";
            updateCard(card.id, { status: "failed", error: message });
            // Cancelled/paused jobs are recoverable queue state, not a
            // library-worthy outcome -- only a genuine failure (not an
            // abort) is worth surfacing in the permanent record.
            registerLibraryEntry({
              id: card.id,
              fileName: card.title || card.platform || card.url,
              title: card.title || card.platform,
              sourceModule: "download",
              platform: card.platform,
              sourceUrl: card.url,
              kind: "other",
              ext: "",
              status: "failed",
              error: message,
            });
          }
        } finally {
          activeControllersRef.current.delete(card.id);
        }
      }
    } finally {
      runningLanesRef.current -= 1;
      if (runningLanesRef.current === 0) setIsProcessing(false);
    }
  }

  function ensureLanes() {
    const capacity = getMaxConcurrentDownloads() - runningLanesRef.current;
    for (let i = 0; i < capacity; i++) void runLane();
  }

  // Adds a card and immediately analyzes it (fetches title/thumbnail/format
  // list) — this step is not queued, matching Downly's concurrent-analyze
  // behavior, since it's a quick metadata lookup rather than a full download.
  const addUrl = useCallback((url: string) => {
    const card = createDownloadCard(url);
    cardsRef.current = [...cardsRef.current, card];
    sync();

    void fetchMediaInfoForCard(url)
      .then((info) => {
        updateCard(card.id, { status: "ready", ...info });
      })
      .catch((err) => {
        updateCard(card.id, {
          status: "info-error",
          error: err instanceof Error ? err.message : "Unable to process this URL.",
        });
      });

    return card.id;
  }, [sync, updateCard]);

  const retryInfo = useCallback(
    (id: string) => {
      const card = cardsRef.current.find((c) => c.id === id);
      if (!card) return;
      updateCard(id, { status: "loading", error: undefined });
      void fetchMediaInfoForCard(card.url)
        .then((info) => updateCard(id, { status: "ready", ...info }))
        .catch((err) =>
          updateCard(id, {
            status: "info-error",
            error: err instanceof Error ? err.message : "Unable to process this URL.",
          })
        );
    },
    [updateCard]
  );

  const setFormat = useCallback(
    (id: string, format: DownloadFormatSelection) => updateCard(id, { selectedFormat: format }),
    [updateCard]
  );

  const startDownload = useCallback((id: string) => {
    updateCard(id, { status: "queued", error: undefined });
    ensureLanes();
    // ensureLanes/runLane close over refs and the stable updateCard, not
    // over anything that would need this callback recreated when they do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateCard]);

  // "Retry": for a job that failed or was cancelled outright (as opposed to
  // deliberately paused, which uses resumeDownload below) -- re-queues the
  // same card in place rather than creating a new one, so it doesn't
  // duplicate the row or lose the destination it already resolved.
  const retryDownload = useCallback((id: string) => {
    const card = cardsRef.current.find((c) => c.id === id);
    if (!card || (card.status !== "failed" && card.status !== "cancelled")) return;
    updateCard(id, { status: "queued", error: undefined });
    ensureLanes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateCard]);

  // "Resume": only meaningful for a job this app itself paused. Re-queuing
  // it runs through the exact same runDownloadJob path as a fresh download —
  // yt-dlp's own default --continue behavior (and the deterministic
  // destination path) is what actually makes this a resume instead of a
  // restart; see runDownload.ts.
  const resumeDownload = useCallback((id: string) => {
    const card = cardsRef.current.find((c) => c.id === id);
    if (!card || card.status !== "paused") return;
    updateCard(id, { status: "queued", error: undefined });
    ensureLanes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateCard]);

  // "Pause": a queued-but-not-yet-started job has no process to stop, so
  // it's marked paused directly; an active one is stopped through the same
  // cancel mechanism as cancelDownload, just tagged via pausedIntentRef so
  // the lane's catch block reports "paused" rather than "cancelled".
  const pauseDownload = useCallback((id: string) => {
    const card = cardsRef.current.find((c) => c.id === id);
    if (!card) return;
    if (card.status === "queued") {
      updateCard(id, { status: "paused" });
      return;
    }
    const controller = activeControllersRef.current.get(id);
    if (!controller) return;
    pausedIntentRef.current.add(id);
    controller.abort();
    cancelDownloadJobOnServer(id);
  }, [updateCard]);

  const cancelDownload = useCallback(
    (id: string) => {
      const controller = activeControllersRef.current.get(id);
      if (controller) {
        controller.abort();
        cancelDownloadJobOnServer(id);
      } else {
        updateCard(id, { status: "cancelled" });
      }
    },
    [updateCard]
  );

  // Removing a card that's still actively running would otherwise orphan a
  // live yt-dlp process with no UI reference left to cancel it -- stop it
  // first, same as a manual cancel, before dropping the row.
  const removeCard = useCallback((id: string) => {
    const controller = activeControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      cancelDownloadJobOnServer(id);
      activeControllersRef.current.delete(id);
      pausedIntentRef.current.delete(id);
    }
    cardsRef.current = cardsRef.current.filter((c) => c.id !== id);
    sync();
  }, [sync]);

  const clearCompleted = useCallback(() => {
    cardsRef.current = cardsRef.current.filter((c) => c.status !== "completed");
    sync();
  }, [sync]);

  // Deliberately leaves actively-running jobs in place rather than silently
  // killing them -- "Clear all" clears the list, not in-flight work; cancel
  // those explicitly first if that's what's wanted.
  const clearAll = useCallback(() => {
    cardsRef.current = cardsRef.current.filter((c) => ACTIVE_STATUSES.includes(c.status));
    sync();
  }, [sync]);

  return {
    cards,
    isProcessing,
    setOutputDir,
    addUrl,
    retryInfo,
    setFormat,
    startDownload,
    pauseDownload,
    resumeDownload,
    retryDownload,
    cancelDownload,
    removeCard,
    clearCompleted,
    clearAll,
  };
}
