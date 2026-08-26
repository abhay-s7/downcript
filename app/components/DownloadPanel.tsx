"use client";

import { useEffect } from "react";
import { useDownloadQueue } from "@/app/hooks/useDownloadQueue";
import { useOutputDir } from "@/app/hooks/useOutputDir";
import DownloadInput from "@/app/components/DownloadInput";
import DownloadCard from "@/app/components/DownloadCard";

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
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <DownloadInput onSubmit={queue.addUrl} />

        <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
          <span>Saving to: {outputDir || "Downloads/Downcript"}</span>
          {isDesktop && (
            <button onClick={chooseFolder} className="text-blue-600 hover:underline">
              Change
            </button>
          )}
        </div>
      </div>

      {queue.cards.length > 0 && (
        <div className="space-y-3">
          {queue.cards.map((card) => (
            <DownloadCard
              key={card.id}
              card={card}
              onSetFormat={(format) => queue.setFormat(card.id, format)}
              onStartDownload={() => queue.startDownload(card.id)}
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
