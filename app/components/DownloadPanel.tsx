"use client";

import { useEffect } from "react";
import { useDownloadQueue } from "@/app/hooks/useDownloadQueue";
import { useOutputDir } from "@/app/hooks/useOutputDir";
import DownloadInput from "@/app/components/DownloadInput";
import DownloadCard from "@/app/components/DownloadCard";
import { CARD_PAD, LINK_MUTED, PATH_CHIP } from "@/app/lib/uiStyles";

export default function DownloadPanel() {
  const queue = useDownloadQueue();
  const { outputDir, isDesktop, chooseFolder } = useOutputDir();

  useEffect(() => {
    queue.setOutputDir(outputDir);
    // queue is a new object every render; only its stable setOutputDir
    // callback (from useCallback) belongs in the dependency array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputDir, queue.setOutputDir]);

  return (
    <div className="space-y-5">
      <div className={CARD_PAD}>
        <DownloadInput onSubmit={queue.addUrl} />

        <div className="mt-3.5 flex items-center gap-2 text-sm text-text-3">
          <span>
            Saving to <span className={PATH_CHIP}>{outputDir || "Downloads/Downcript"}</span>
          </span>
          {isDesktop && (
            <button onClick={chooseFolder} className={LINK_MUTED}>
              Change
            </button>
          )}
        </div>
      </div>

      {queue.cards.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-end gap-4 text-sm">
            <button onClick={queue.clearCompleted} className={LINK_MUTED}>
              Clear completed
            </button>
            <button onClick={queue.clearAll} className={LINK_MUTED}>
              Clear all
            </button>
          </div>

          {queue.cards.map((card) => (
            <DownloadCard
              key={card.id}
              card={card}
              onSetFormat={(format) => queue.setFormat(card.id, format)}
              onStartDownload={() => queue.startDownload(card.id)}
              onPause={() => queue.pauseDownload(card.id)}
              onResume={() => queue.resumeDownload(card.id)}
              onRetryDownload={() => queue.retryDownload(card.id)}
              onCancel={() => queue.cancelDownload(card.id)}
              onRetryInfo={() => queue.retryInfo(card.id)}
              onRemove={() => queue.removeCard(card.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
