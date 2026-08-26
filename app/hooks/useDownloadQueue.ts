"use client";

import { useCallback, useRef, useState } from "react";
import {
  cancelDownloadJobOnServer,
  createDownloadCard,
  DownloadCard,
  DownloadFormatSelection,
  fetchMediaInfoForCard,
  runDownloadJob,
} from "@/app/lib/downloadJobs";

// Mirrors useTranscriptionQueue's shape (sequential worker over a shared
// ref, `cards` state kept in sync purely for render) but for downloads,
// which have an extra pre-queue step: pasting a URL analyzes it immediately
// (not queued — Downly did this concurrently too), and only the actual
// download enters the one-at-a-time worker once the user picks a format.
export function useDownloadQueue() {
  const cardsRef = useRef<DownloadCard[]>([]);
  const [cards, setCards] = useState<DownloadCard[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const cancelRequestedRef = useRef(false);
  const workerRunningRef = useRef(false);
  const currentAbortRef = useRef<AbortController | null>(null);
  const currentCardIdRef = useRef<string | null>(null);
  const outputDirRef = useRef<string | undefined>(undefined);

  const sync = useCallback(() => setCards([...cardsRef.current]), []);

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

  const runWorker = useCallback(async () => {
    if (workerRunningRef.current) return;
    workerRunningRef.current = true;
    setIsProcessing(true);

    try {
      while (true) {
        if (cancelRequestedRef.current) break;

        const next = cardsRef.current.find((c) => c.status === "pending");
        if (!next) break;

        currentCardIdRef.current = next.id;
        const controller = new AbortController();
        currentAbortRef.current = controller;

        updateCard(next.id, { status: "processing", error: undefined, progress: undefined });

        try {
          const result = await runDownloadJob(next, outputDirRef.current, controller.signal, (patch) =>
            updateCard(next.id, patch)
          );
          updateCard(next.id, { status: "completed", filePath: result.filePath, fileName: result.fileName });
        } catch (err) {
          if (controller.signal.aborted) {
            updateCard(next.id, { status: "cancelled" });
          } else {
            updateCard(next.id, {
              status: "failed",
              error: err instanceof Error ? err.message : "Download failed.",
            });
          }
        } finally {
          currentAbortRef.current = null;
          currentCardIdRef.current = null;
        }
      }
    } finally {
      workerRunningRef.current = false;
      setIsProcessing(false);

      if (cancelRequestedRef.current) {
        cardsRef.current = cardsRef.current.map((c) =>
          c.status === "pending" ? { ...c, status: "cancelled" } : c
        );
        sync();
      }
    }
  }, [updateCard, sync]);

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

  const startDownload = useCallback(
    (id: string) => {
      cancelRequestedRef.current = false;
      updateCard(id, { status: "pending", error: undefined });
      sync();
      void runWorker();
    },
    [updateCard, sync, runWorker]
  );

  const cancelDownload = useCallback(
    (id: string) => {
      if (currentCardIdRef.current === id) {
        cancelRequestedRef.current = true;
        currentAbortRef.current?.abort();
        cancelDownloadJobOnServer(id);
      } else {
        updateCard(id, { status: "cancelled" });
      }
    },
    [updateCard]
  );

  const removeCard = useCallback((id: string) => {
    cardsRef.current = cardsRef.current.filter((c) => c.id !== id);
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
    cancelDownload,
    removeCard,
  };
}
