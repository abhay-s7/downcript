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
        } catch (err) {
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

  const generateTranscript = useCallback(
    (groupId: string, creativeId: string, outputFormat: "original" | "hinglish") => {
      const group = groupsRef.current.find((g) => g.id === groupId);
      const creative = group?.creatives.find((c) => c.id === creativeId);
      if (!creative) return;

      updateCreative(groupId, creativeId, { transcriptStatus: "processing", transcriptError: undefined });
      void runMetaTranscribeJob(creative, outputFormat)
        .then(() => updateCreative(groupId, creativeId, { transcriptStatus: "completed" }))
        .catch((err) =>
          updateCreative(groupId, creativeId, {
            transcriptStatus: "failed",
            transcriptError: err instanceof Error ? err.message : "Transcription failed.",
          })
        );
    },
    [updateCreative]
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
    cancelCreative,
    generateTranscript,
    removeGroup,
  };
}
