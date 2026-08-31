"use client";

import { useState } from "react";
import { useOutputDir } from "@/app/hooks/useOutputDir";
import { isCompletionSoundEnabled, setCompletionSoundEnabled } from "@/app/lib/services/notifications/completionNotifier";
import {
  CONCURRENCY_OPTIONS,
  getMaxConcurrentDownloads,
  setMaxConcurrentDownloads,
} from "@/app/lib/services/settings/downloadConcurrency";
import {
  NAMING_TEMPLATE_OPTIONS,
  getNamingTemplate,
  setNamingTemplate,
} from "@/app/lib/services/settings/namingPreference";
import { NamingTemplate } from "@/app/lib/services/filesystem/naming";

export default function SettingsPanel() {
  const { outputDir, isDesktop, chooseFolder } = useOutputDir();
  const [soundEnabled, setSoundEnabled] = useState(() => isCompletionSoundEnabled());
  const [maxConcurrent, setMaxConcurrent] = useState(() => getMaxConcurrentDownloads());
  const [namingTemplate, setNamingTemplateState] = useState<NamingTemplate>(() => getNamingTemplate());

  function handleToggleSound(checked: boolean) {
    setSoundEnabled(checked);
    setCompletionSoundEnabled(checked);
  }

  function handleConcurrencyChange(value: number) {
    setMaxConcurrent(value);
    setMaxConcurrentDownloads(value);
  }

  function handleNamingTemplateChange(value: NamingTemplate) {
    setNamingTemplateState(value);
    setNamingTemplate(value);
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
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Downloads</h2>
        <p className="text-sm text-gray-500 mb-3">
          How many downloads can run at the same time. A higher number finishes a batch faster but
          uses more bandwidth and CPU per download.
        </p>
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span>Simultaneous downloads:</span>
          <select
            value={maxConcurrent}
            onChange={(e) => handleConcurrencyChange(Number(e.target.value))}
            className="rounded-md border border-gray-300 text-sm px-2 py-1"
          >
            {CONCURRENCY_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">File naming</h2>
        <p className="text-sm text-gray-500 mb-3">
          How new files are named — applies to Download and Meta Ads (a video and its transcript
          share the same name, so a subtitle file matches its video). Only affects new files;
          nothing already on disk gets renamed. When a creator/account name isn&apos;t available
          for a given download, it falls back to title only regardless of this setting.
        </p>
        <div className="space-y-1.5">
          {NAMING_TEMPLATE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="radio"
                name="namingTemplate"
                checked={namingTemplate === opt.value}
                onChange={() => handleNamingTemplateChange(opt.value)}
                className="accent-blue-600"
              />
              {opt.label}
              <span className="text-gray-400">— {opt.example}</span>
            </label>
          ))}
        </div>
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
