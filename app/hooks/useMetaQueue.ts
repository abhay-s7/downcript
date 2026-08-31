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
import { notifyTaskComplete } from "@/app/lib/services/notifications/completionNotifier";
import { registerLibraryEntry } from "@/app/lib/services/library/libraryClient";

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
  // "Download All" completion notification: a batch, not N independent
  // tasks -- one sound when every member reaches a terminal state, not one
  // per creative. batchMembersRef maps a creative id to the token of the
  // batch it belongs to (only set for creatives enqueued by downloadAll);
  // batchStateRef tracks each batch's remaining count and whether anything
  // in it actually succeeded (a batch that's all failures/cancellations
  // stays silent, same as a single failed/cancelled task would).
  const batchMembersRef = useRef<Map<string, number>>(new Map());
  const batchStateRef = useRef<Map<number, { remaining: number; anySucceeded: boolean }>>(new Map());
  const nextBatchTokenRef = useRef(0);

  function resolveBatchOutcome(creativeId: string, succeeded: boolean) {
    const token = batchMembersRef.current.get(creativeId);
    if (token === undefined) return false;
    batchMembersRef.current.delete(creativeId);

    const state = batchStateRef.current.get(token);
    if (!state) return true;
    state.remaining -= 1;
    if (succeeded) state.anySucceeded = true;
    if (state.remaining <= 0) {
      batchStateRef.current.delete(token);
      if (state.anySucceeded) notifyTaskComplete("Batch download completed.");
    }
    return true;
  }

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
      .then((result) => {
        updateCreative(groupId, creativeId, { transcriptStatus: "completed" });
        // Covers both a standalone "Transcript Only" click and the tail end
        // of "Download Video + Transcript" -- either way, this is always
        // the true final step of whichever action the user asked for, so
        // notifying unconditionally here is correct for both callers. The
        // combo's own download-completion step is the one that suppresses
        // itself (see the worker loop below) to avoid firing twice.
        notifyTaskComplete(`Transcript ready for ${creative.fileName}.`);

        for (const filePath of Object.values(result.paths)) {
          if (!filePath) continue;
          const exportFileName = filePath.split(/[/\\]/).pop() || filePath;
          registerLibraryEntry({
            id: filePath,
            filePath,
            fileName: exportFileName,
            title: adLibraryTitle(groupId, creativeId),
            sourceModule: "meta-ads",
            platform: "Meta Ads",
            sourceUrl: groupsRef.current.find((g) => g.id === groupId)?.url,
            kind: "transcript",
            ext: exportFileName.split(".").pop() || "",
            status: "completed",
          });
        }
      })
      .catch((err) =>
        updateCreative(groupId, creativeId, {
          transcriptStatus: "failed",
          transcriptError: err instanceof Error ? err.message : "Transcription failed.",
        })
      );
  }

  // Matches MetaAdCard's own "{pageName || 'Meta Ad'} — #{adArchiveId}" convention,
  // so a library entry reads the same way the ad did in its own queue card.
  function adLibraryTitle(groupId: string, creativeId: string): string {
    const group = groupsRef.current.find((g) => g.id === groupId);
    const creative = group?.creatives.find((c) => c.id === creativeId);
    return `${group?.pageName || "Meta Ad"} — #${creative?.adArchiveId ?? ""}`;
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

          registerLibraryEntry({
            id: creative.id,
            filePath: result.filePath,
            fileName: result.fileName,
            title: adLibraryTitle(groupId, creative.id),
            sourceModule: "meta-ads",
            platform: "Meta Ads",
            sourceUrl: groupsRef.current.find((g) => g.id === groupId)?.url,
            kind: creative.kind,
            ext: result.fileName.split(".").pop() || "",
            status: "completed",
          });

          const wasBatchMember = resolveBatchOutcome(creative.id, true);
          const autoTranscribe = autoTranscribeRef.current.get(creative.id);
          if (autoTranscribe) {
            autoTranscribeRef.current.delete(creative.id);
            // The combo's transcription step (startTranscription) fires its
            // own notification when IT finishes -- this download completion
            // is just the combo's first half, not the user's actual end
            // goal, so it stays silent here.
            startTranscription(groupId, creative.id, autoTranscribe.outputFormat, autoTranscribe.formats);
          } else if (!wasBatchMember) {
            // A plain, standalone "Download Video" -- not part of a batch
            // and not the download-half of a combo -- so this genuinely is
            // the end of the task the user asked for.
            notifyTaskComplete(`${result.fileName} finished downloading.`);
          }
        } catch (err) {
          // Download itself failed/was cancelled -- nothing to transcribe,
          // so don't leave a stale auto-transcribe request behind for a
          // possible future retry of this same creative id.
          autoTranscribeRef.current.delete(creative.id);
          resolveBatchOutcome(creative.id, false);
          if (controller.signal.aborted) {
            updateCreative(groupId, creative.id, { status: "cancelled" });
          } else {
            const message = err instanceof Error ? err.message : "Download failed.";
            updateCreative(groupId, creative.id, { status: "failed", error: message });
            registerLibraryEntry({
              id: creative.id,
              fileName: creative.fileName,
              title: adLibraryTitle(groupId, creative.id),
              sourceModule: "meta-ads",
              platform: "Meta Ads",
              sourceUrl: groupsRef.current.find((g) => g.id === groupId)?.url,
              kind: "other",
              ext: "",
              status: "failed",
              error: message,
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
        for (const g of groupsRef.current) {
          for (const c of g.creatives) {
            if (c.status === "pending") resolveBatchOutcome(c.id, false);
          }
        }
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

      const eligibleIds = group.creatives
        .filter((c) => c.status === "ready" || c.status === "failed" || c.status === "cancelled")
        .map((c) => c.id);

      // One notification for the whole batch, not one per creative -- see
      // batchMembersRef/batchStateRef and resolveBatchOutcome above.
      if (eligibleIds.length > 0) {
        const token = nextBatchTokenRef.current++;
        batchStateRef.current.set(token, { remaining: eligibleIds.length, anySucceeded: false });
        for (const id of eligibleIds) batchMembersRef.current.set(id, token);
      }

      groupsRef.current = groupsRef.current.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              creatives: g.creatives.map((c) =>
                eligibleIds.includes(c.id) ? { ...c, status: "pending", error: undefined } : c
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
        // Not currently the active job (e.g. still queued) -- no UI path
        // triggers this today (there's no cancel affordance for a merely
        // "pending" card), but resolve batch bookkeeping defensively so a
        // future caller can't leave a batch's counter stuck mid-flight.
        resolveBatchOutcome(creativeId, false);
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
