"use client";

import { useCallback, useRef, useState } from "react";
import { TranscriptionJob, cancelJobOnServer, runJob } from "@/app/lib/jobs";
import { notifyTaskComplete } from "@/app/lib/services/notifications/completionNotifier";

// A single shared queue + worker for every transcription source (upload,
// YouTube, Instagram, Google Drive). Only one job is ever "processing" at a
// time. `jobsRef` is the source of truth the sequential worker loop reads
// synchronously (avoiding stale closures across awaits); `jobs` state is
// kept in sync purely so render sees the latest array — render never reads
// the ref directly.
export function useTranscriptionQueue() {
  const jobsRef = useRef<TranscriptionJob[]>([]);
  const [jobs, setJobs] = useState<TranscriptionJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const cancelRequestedRef = useRef(false);
  const workerRunningRef = useRef(false);
  const currentAbortRef = useRef<AbortController | null>(null);
  const currentJobIdRef = useRef<string | null>(null);

  const sync = useCallback(() => setJobs(jobsRef.current), []);

  const updateJob = useCallback(
    (id: string, patch: Partial<TranscriptionJob>) => {
      jobsRef.current = jobsRef.current.map((j) => (j.id === id ? { ...j, ...patch } : j));
      sync();
    },
    [sync]
  );

  const runWorker = useCallback(async () => {
    if (workerRunningRef.current) return; // never run two workers at once
    workerRunningRef.current = true;
    setIsProcessing(true);

    try {
      while (true) {
        if (cancelRequestedRef.current) break;

        const next = jobsRef.current.find((j) => j.status === "pending");
        if (!next) break;

        currentJobIdRef.current = next.id;
        const controller = new AbortController();
        currentAbortRef.current = controller;

        updateJob(next.id, { status: "processing", error: undefined, dailymotionProgress: undefined });

        try {
          const result = await runJob(next, controller.signal, (patch) =>
            updateJob(next.id, patch)
          );
          updateJob(next.id, {
            status: "completed",
            transcript: result.transcript,
            originalTranscript: result.originalTranscript,
          });
          notifyTaskComplete(`${next.fileName} finished transcribing.`);
        } catch (err) {
          if (controller.signal.aborted) {
            updateJob(next.id, { status: "cancelled" });
          } else {
            updateJob(next.id, {
              status: "failed",
              error: err instanceof Error ? err.message : "Transcription failed.",
            });
          }
        } finally {
          currentAbortRef.current = null;
          currentJobIdRef.current = null;
        }
      }
    } finally {
      workerRunningRef.current = false;
      setIsProcessing(false);

      if (cancelRequestedRef.current) {
        jobsRef.current = jobsRef.current.map((j) =>
          j.status === "pending" ? { ...j, status: "cancelled" } : j
        );
        sync();
      }
    }
  }, [updateJob, sync]);

  const addJobs = useCallback(
    (newJobs: TranscriptionJob[]) => {
      if (newJobs.length === 0) return;
      jobsRef.current = [...jobsRef.current, ...newJobs];
      sync();
      void runWorker();
    },
    [sync, runWorker]
  );

  const cancelProcessing = useCallback(() => {
    cancelRequestedRef.current = true;

    const activeJobId = currentJobIdRef.current;
    currentAbortRef.current?.abort();
    if (activeJobId) cancelJobOnServer(activeJobId);

    // If the worker isn't actively running, there's no loop left to mark
    // leftover pending jobs as cancelled on exit — do it here instead.
    if (!workerRunningRef.current) {
      jobsRef.current = jobsRef.current.map((j) =>
        j.status === "pending" ? { ...j, status: "cancelled" } : j
      );
      sync();
    }
  }, [sync]);

  const resume = useCallback(() => {
    cancelRequestedRef.current = false;
    jobsRef.current = jobsRef.current.map((j) =>
      j.status === "cancelled" ? { ...j, status: "pending" } : j
    );
    sync();
    void runWorker();
  }, [sync, runWorker]);

  const retryFailed = useCallback(() => {
    cancelRequestedRef.current = false;
    jobsRef.current = jobsRef.current.map((j) =>
      j.status === "failed" ? { ...j, status: "pending", error: undefined } : j
    );
    sync();
    void runWorker();
  }, [sync, runWorker]);

  const retryJob = useCallback(
    (id: string) => {
      cancelRequestedRef.current = false;
      jobsRef.current = jobsRef.current.map((j) =>
        j.id === id && j.status === "failed" ? { ...j, status: "pending", error: undefined } : j
      );
      sync();
      void runWorker();
    },
    [sync, runWorker]
  );

  return {
    jobs,
    isProcessing,
    addJobs,
    cancelProcessing,
    resume,
    retryFailed,
    retryJob,
  };
}
