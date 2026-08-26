"use client";

import { useEffect, useState } from "react";
import { useDownloadQueue } from "@/app/hooks/useDownloadQueue";
import DownloadInput from "@/app/components/DownloadInput";
import DownloadCard from "@/app/components/DownloadCard";

export default function DownloadPanel() {
  const queue = useDownloadQueue();
  const [folder, setFolder] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;

    void (async () => {
      setIsDesktop(true);
      setFolder(await desktop.defaultDownloadDir());
    })();
  }, []);

  async function handleChooseFolder() {
    if (!window.desktop) return;
    const chosen = await window.desktop.chooseFolder();
    if (chosen) {
      setFolder(chosen);
      queue.setOutputDir(chosen);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <DownloadInput onSubmit={queue.addUrl} />

        <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
          <span>Saving to: {folder || "Downloads/Downcript"}</span>
          {isDesktop && (
            <button onClick={handleChooseFolder} className="text-blue-600 hover:underline">
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
