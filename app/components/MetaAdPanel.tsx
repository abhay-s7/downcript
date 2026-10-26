"use client";

import { useEffect, useMemo, useState } from "react";
import { useMetaQueue } from "@/app/hooks/useMetaQueue";
import { useOutputDir } from "@/app/hooks/useOutputDir";
import { OutputFormat } from "@/app/lib/jobs";
import { TranscriptFormat } from "@/app/lib/services/meta/types";
import { extractMetaAdId } from "@/app/lib/services/meta/urlValidation";
import MetaAdInput from "@/app/components/MetaAdInput";
import MetaAdBatchInput from "@/app/components/MetaAdBatchInput";
import MetaAdCard from "@/app/components/MetaAdCard";
import CompetitorAdResearch from "@/app/components/CompetitorAdResearch";
import IncludeTimestampsToggle from "@/app/components/IncludeTimestampsToggle";
import OutputFormatToggle from "@/app/components/OutputFormatToggle";
import TranscriptFormatSelector from "@/app/components/TranscriptFormatSelector";
import { getIncludeTimestamps, setIncludeTimestamps } from "@/app/lib/services/settings/timestampPreference";
import { CARD_PAD, DIVIDER, LINK_MUTED, PATH_CHIP } from "@/app/lib/uiStyles";

export default function MetaAdPanel() {
  const queue = useMetaQueue();
  const { outputDir, isDesktop, chooseFolder } = useOutputDir();
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("hinglish");
  // Applies globally to every video creative across every ad in this panel,
  // including each video in a carousel -- there's no per-creative override,
  // matching how outputFormat (Original/Hinglish) already works here.
  // Defaults to DOCX only, so a first-time "Generate Transcript" doesn't
  // silently write three files nobody asked for.
  const [transcriptFormats, setTranscriptFormats] = useState<Set<TranscriptFormat>>(
    () => new Set(["docx"])
  );
  // Shared with the Transcript tab's own toggle (same localStorage-backed
  // preference, app/lib/services/settings/timestampPreference.ts) rather
  // than a second independent setting -- picking it here also becomes the
  // default next time the Transcript tab is opened, and vice versa.
  const [includeTimestamps, setIncludeTimestampsState] = useState<boolean>(() => getIncludeTimestamps());

  function handleIncludeTimestampsChange(value: boolean) {
    setIncludeTimestampsState(value);
    setIncludeTimestamps(value);
  }

  useEffect(() => {
    queue.setOutputDir(outputDir);
    // queue is a new object every render; only its stable setOutputDir
    // callback (from useCallback) belongs in the dependency array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputDir, queue.setOutputDir]);

  // Ad ids already in the queue (resolved or not -- a still-loading or
  // resolve-error group still has its original URL) -- passed to the batch
  // input so a re-paste of something already queued is caught as a
  // duplicate too, not just duplicates within the same paste. Computed
  // before the isDesktop early return below since hooks can't follow one.
  const existingAdIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of queue.groups) {
      const id = extractMetaAdId(group.url);
      if (id) ids.add(id);
    }
    return ids;
  }, [queue.groups]);

  if (!isDesktop) {
    return (
      <div className="bg-surface border border-line rounded-2xl p-6 text-sm text-text-2">
        Meta Ad extraction needs to run inside the desktop app — it isn&apos;t available in a plain
        browser tab.
      </div>
    );
  }

  const formatsList = Array.from(transcriptFormats);

  function handleAddBatchUrls(urls: string[]) {
    for (const url of urls) queue.addUrl(url);
  }

  return (
    <div className="space-y-5">
      <div className={CARD_PAD}>
        <MetaAdInput onSubmit={queue.addUrl} />

        <div className="mt-3.5 flex items-center justify-between text-sm text-text-3 flex-wrap gap-2.5">
          <div className="flex items-center gap-2">
            <span>
              Saving to <span className={PATH_CHIP}>{outputDir || "Downloads/Downcript"}</span>
            </span>
            <button onClick={chooseFolder} className={LINK_MUTED}>
              Change
            </button>
          </div>
          <OutputFormatToggle value={outputFormat} onChange={setOutputFormat} />
        </div>

        <div className={DIVIDER} />
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TranscriptFormatSelector selected={transcriptFormats} onChange={setTranscriptFormats} />
          <IncludeTimestampsToggle value={includeTimestamps} onChange={handleIncludeTimestampsChange} />
        </div>

        <MetaAdBatchInput existingAdIds={existingAdIds} onAddUrls={handleAddBatchUrls} />
      </div>

      {queue.groups.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-end">
            <button onClick={queue.clearCompleted} className={LINK_MUTED}>
              Clear completed
            </button>
          </div>

          {queue.groups.map((group) => (
            <MetaAdCard
              key={group.id}
              group={group}
              transcriptFormatsSelected={formatsList.length > 0}
              onDownloadCreative={(creativeId) => queue.downloadCreative(group.id, creativeId)}
              onDownloadAll={() => queue.downloadAll(group.id)}
              onCancelCreative={(creativeId) => queue.cancelCreative(group.id, creativeId)}
              onTranscriptOnly={(creativeId) =>
                queue.transcriptOnly(group.id, creativeId, outputFormat, formatsList, includeTimestamps)
              }
              onDownloadAndTranscript={(creativeId) =>
                queue.downloadAndTranscribe(group.id, creativeId, outputFormat, formatsList, includeTimestamps)
              }
              onRemove={() => queue.removeGroup(group.id)}
            />
          ))}
        </div>
      )}

      {/* Secondary workflow, deliberately last: Analyze Meta Ad (above) and
          its results are the primary focus, so research stays below them
          regardless of how many results are showing. */}
      <CompetitorAdResearch />
    </div>
  );
}
