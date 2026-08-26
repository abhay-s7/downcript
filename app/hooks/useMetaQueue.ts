"use client";

import { useCallback, useRef, useState } from "react";
import {
  cancelMetaJobOnServer,
  createMetaAdGroup,
  MetaAdGroup,
  MetaCreativeJob,
  resolveMetaAd,
  runMetaCreativeJob,
  runMetaTranscribeJob,
} from "@/app/lib/metaJobs";
import { TranscriptFormat } from "@/app/lib/services/meta/types";

type OutputFormat = "original" | "hinglish";

// Same worker-loop shape as useDownloadQueue/useTranscriptionQueue, but the
// unit of work (a creative) is nested inside a group (the ad) for display --
// "download all" on an ad enqueues every ready creative, one at a time,
// same as everywhere else in the app.
export function useMetaQueue() {
  const groupsRef = useRef<MetaAdGroup[]>([]);
  const [groups, setGroups] = useState<MetaAdGroup[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const cancelRequestedRef = useRef(false);
  const workerRunningRef = useRef(false);
  const currentAbortRef = useRef<AbortController | null>(null);
  const currentJobIdRef = useRef<string | null>(null);
  const outputDirRef = useRef<string | undefined>(undefined);
  // Set only by "Download Video + Transcript" -- checked once a creative's
  // download completes so transcription can start automatically, using
  // whatever format(s) were selected at the moment the combo action was
  // clicked (not re-read later, in case the user changes the checkboxes
  // while the download is still in the queue).
  const autoTranscribeRef = useRef<Map<string, { outputFormat: OutputFormat; formats: TranscriptFormat[] }>>(
    new Map()
  );

  const sync = useCallback(() => setGroups([...groupsRef.current]), []);

  const updateGroup = useCallback(
    (groupId: string, patch: Partial<MetaAdGroup>) => {
      groupsRef.current = groupsRef.current.map((g) => (g.id === groupId ? { ...g, ...patch } : g));
      sync();
    },
    [sync]
  );

  const updateCreative = useCallback(
    (groupId: string, creativeId: string, patch: Partial<MetaCreativeJob>) => {
      groupsRef.current = groupsRef.current.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          creatives: g.creatives.map((c) => (c.id === creativeId ? { ...c, ...patch } : c)),
        };
      });
      sync();
    },
    [sync]
  );

  const setOutputDir = useCallback((dir: string | undefined) => {
    outputDirRef.current = dir;
  }, []);

  // Shared by the public generateTranscript() and the worker's automatic
  // post-download transcription (for "Download Video + Transcript") --
  // plain function rather than useCallback since it's only ever called from
  // inside other callbacks in this hook, never returned to a component.
  function startTranscription(
    groupId: string,
    creativeId: string,
    outputFormat: OutputFormat,
    formats: TranscriptFormat[]
  ) {
    const group = groupsRef.current.find((g) => g.id === groupId);
    const creative = group?.creatives.find((c) => c.id === creativeId);
    if (!creative) return;

    updateCreative(groupId, creativeId, { transcriptStatus: "processing", transcriptError: undefined });
    void runMetaTranscribeJob(creative, outputFormat, formats, outputDirRef.current)
      .then(() => updateCreative(groupId, creativeId, { transcriptStatus: "completed" }))
      .catch((err) =>
        updateCreative(groupId, creativeId, {
          transcriptStatus: "failed",
          transcriptError: err instanceof Error ? err.message : "Transcription failed.",
        })
      );
  }

  function findPendingCreative(): { groupId: string; creative: MetaCreativeJob } | null {
    for (const group of groupsRef.current) {
      const creative = group.creatives.find((c) => c.status === "pending");
      if (creative) return { groupId: group.id, creative };
    }
    return null;
  }

  const runWorker = useCallback(async () => {
    if (workerRunningRef.current) return;
    workerRunningRef.current = true;
    setIsProcessing(true);

    try {
      while (true) {
        if (cancelRequestedRef.current) break;
        const next = findPendingCreative();
        if (!next) break;

        const { groupId, creative } = next;
        currentJobIdRef.current = creative.id;
        const controller = new AbortController();
        currentAbortRef.current = controller;

        updateCreative(groupId, creative.id, { status: "processing", error: undefined, progress: undefined });

        try {
          const result = await runMetaCreativeJob(creative, outputDirRef.current, controller.signal, (patch) =>
            updateCreative(groupId, creative.id, patch)
          );
          updateCreative(groupId, creative.id, {
            status: "completed",
            filePath: result.filePath,
            fileName: result.fileName,
          });

          const autoTranscribe = autoTranscribeRef.current.get(creative.id);
          if (autoTranscribe) {
            autoTranscribeRef.current.delete(creative.id);
            startTranscription(groupId, creative.id, autoTranscribe.outputFormat, autoTranscribe.formats);
          }
        } catch (err) {
          // Download itself failed/was cancelled -- nothing to transcribe,
          // so don't leave a stale auto-transcribe request behind for a
          // possible future retry of this same creative id.
          autoTranscribeRef.current.delete(creative.id);
          if (controller.signal.aborted) {
            updateCreative(groupId, creative.id, { status: "cancelled" });
          } else {
            updateCreative(groupId, creative.id, {
              status: "failed",
              error: err instanceof Error ? err.message : "Download failed.",
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
        groupsRef.current = groupsRef.current.map((g) => ({
          ...g,
          creatives: g.creatives.map((c) => (c.status === "pending" ? { ...c, status: "cancelled" } : c)),
        }));
        sync();
      }
    }
    // startTranscription is a plain function redefined every render (see
    // its own comment) -- it closes over refs and the stable updateCreative,
    // not over anything that needs runWorker to be recreated when it does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateCreative, sync]);

  const addUrl = useCallback((url: string) => {
    const group = createMetaAdGroup(url);
    groupsRef.current = [...groupsRef.current, group];
    sync();

    void resolveMetaAd(url)
      .then((resolved) => {
        updateGroup(group.id, {
          status: "ready",
          adArchiveId: resolved.adArchiveId,
          pageName: resolved.pageName,
          adType: resolved.adType,
          creatives: resolved.creatives,
        });
      })
      .catch((err) => {
        updateGroup(group.id, {
          status: "resolve-error",
          error: err instanceof Error ? err.message : "Unable to process this ad.",
        });
      });

    return group.id;
  }, [sync, updateGroup]);

  const downloadCreative = useCallback(
    (groupId: string, creativeId: string) => {
      cancelRequestedRef.current = false;
      updateCreative(groupId, creativeId, { status: "pending", error: undefined });
      void runWorker();
    },
    [updateCreative, runWorker]
  );

  const downloadAll = useCallback(
    (groupId: string) => {
      cancelRequestedRef.current = false;
      const group = groupsRef.current.find((g) => g.id === groupId);
      if (!group) return;
      groupsRef.current = groupsRef.current.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              creatives: g.creatives.map((c) =>
                c.status === "ready" || c.status === "failed" || c.status === "cancelled"
                  ? { ...c, status: "pending", error: undefined }
                  : c
              ),
            }
      );
      sync();
      void runWorker();
    },
    [sync, runWorker]
  );

  const cancelCreative = useCallback(
    (groupId: string, creativeId: string) => {
      if (currentJobIdRef.current === creativeId) {
        cancelRequestedRef.current = true;
        currentAbortRef.current?.abort();
        cancelMetaJobOnServer(creativeId);
      } else {
        updateCreative(groupId, creativeId, { status: "cancelled" });
      }
    },
    [updateCreative]
  );

  // "Transcript Only": works whether or not the creative was already
  // downloaded -- startTranscription/runMetaTranscribeJob transcribes the
  // already-kept file if there is one, or fetches a throwaway temp copy and
  // discards it otherwise. Either way, this never sets the creative's
  // download `status`, since a video fetched only for this purpose is
  // deliberately not a kept output.
  const transcriptOnly = useCallback(
    (groupId: string, creativeId: string, outputFormat: OutputFormat, formats: TranscriptFormat[]) => {
      startTranscription(groupId, creativeId, outputFormat, formats);
    },
    // startTranscription is a plain function (not useCallback) that only
    // closes over refs and the stable updateCreative, so it's safe to omit
    // from deps -- it's not itself a changing value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // "Download Video + Transcript": enqueues the download like
  // downloadCreative, but records the chosen format(s) so the worker starts
  // transcription automatically the moment the download completes.
  const downloadAndTranscribe = useCallback(
    (groupId: string, creativeId: string, outputFormat: OutputFormat, formats: TranscriptFormat[]) => {
      autoTranscribeRef.current.set(creativeId, { outputFormat, formats });
      cancelRequestedRef.current = false;
      updateCreative(groupId, creativeId, { status: "pending", error: undefined });
      void runWorker();
    },
    [updateCreative, runWorker]
  );

  const removeGroup = useCallback((groupId: string) => {
    groupsRef.current = groupsRef.current.filter((g) => g.id !== groupId);
    sync();
  }, [sync]);

  return {
    groups,
    isProcessing,
    setOutputDir,
    addUrl,
    downloadCreative,
    downloadAll,
    downloadAndTranscribe,
    cancelCreative,
    transcriptOnly,
    removeGroup,
  };
}
