"use client";

import { useState } from "react";
import { useOutputDir } from "@/app/hooks/useOutputDir";
import { isCompletionSoundEnabled, setCompletionSoundEnabled } from "@/app/lib/services/notifications/completionNotifier";

export default function SettingsPanel() {
  const { outputDir, isDesktop, chooseFolder } = useOutputDir();
  const [soundEnabled, setSoundEnabled] = useState(() => isCompletionSoundEnabled());

  function handleToggleSound(checked: boolean) {
    setSoundEnabled(checked);
    setCompletionSoundEnabled(checked);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Default save location</h2>
        <p className="text-sm text-gray-500 mb-3">
          Where Download and Meta Ads save files by default. Each can still be changed per-job.
        </p>
        {isDesktop ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-700">{outputDir || "Downloads/Downcript"}</span>
            <button onClick={chooseFolder} className="text-blue-600 hover:underline">
              Change
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Only available in the desktop app.</p>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Notifications</h2>
        <p className="text-sm text-gray-500 mb-3">
          Play a short sound when a download, transcript, or Meta Ad task finishes — useful when
          the window isn&apos;t in focus. A batch (e.g. Download All on a carousel) plays one
          sound when the whole batch is done, not once per file.
        </p>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(e) => handleToggleSound(e.target.checked)}
            className="accent-blue-600"
          />
          Completion sound
        </label>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">About Meta Ad extraction</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          Meta doesn&apos;t provide an API that returns ad creative files directly, so this
          feature reads the same public Ad Library page a browser would. Meta can change that
          page&apos;s format at any time, which may break extraction until this app is updated —
          if an ad fails to process, that&apos;s the most likely reason.
        </p>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Diagnostics</h2>
        <p className="text-sm text-gray-500 mb-3">
          Technical error details are written to a log file, separate from the plain-language
          messages shown in the app.
        </p>
        {isDesktop ? (
          <button
            onClick={() => window.desktop?.openLogsFolder()}
            className="text-sm text-blue-600 hover:underline"
          >
            View logs
          </button>
        ) : (
          <p className="text-sm text-gray-400">Only available in the desktop app.</p>
        )}
      </section>
    </div>
  );
}
