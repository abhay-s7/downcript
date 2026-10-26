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
import Switch from "@/app/components/Switch";
import { CARD, LINK, SELECT_SM } from "@/app/lib/uiStyles";

const SETTING_ROW = "flex items-center justify-between gap-6 py-4.5 border-t border-line first:border-t-0 first:pt-0";

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
    <div className="max-w-2xl">
      <p className="font-mono text-[11px] tracking-[.14em] uppercase text-accent mb-3.5">Settings</p>
      <h1 className="font-medium text-[clamp(32px,4vw,46px)] leading-[1.05] tracking-[-.04em] mb-5">
        <span className="bg-gradient-to-r from-text from-20% to-text-3 bg-clip-text text-transparent">Make it yours.</span>
      </h1>
      <p className="text-text-2 text-[15.5px] max-w-[540px] mb-8">Defaults for saving, quality and transcripts.</p>

      <div className={`${CARD} p-6`}>
        <div className={SETTING_ROW}>
          <div>
            <h4 className="font-medium text-[14px] text-text mb-0.5">Save location</h4>
            <p className="text-sm text-text-3">
              {isDesktop ? outputDir || "Downloads/Downcript" : "Only available in the desktop app."}
            </p>
          </div>
          {isDesktop && (
            <button onClick={chooseFolder} className={`${LINK} flex-shrink-0`}>
              Change
            </button>
          )}
        </div>

        <div className={SETTING_ROW}>
          <div>
            <h4 className="font-medium text-[14px] text-text mb-0.5">Simultaneous downloads</h4>
            <p className="text-sm text-text-3">
              A higher number finishes a batch faster but uses more bandwidth and CPU per download.
            </p>
          </div>
          <select
            value={maxConcurrent}
            onChange={(e) => handleConcurrencyChange(Number(e.target.value))}
            className={`${SELECT_SM} flex-shrink-0`}
          >
            {CONCURRENCY_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className={`${SETTING_ROW} items-start`}>
          <div>
            <h4 className="font-medium text-[14px] text-text mb-0.5">File naming</h4>
            <p className="text-sm text-text-3 max-w-[320px]">
              Applies to new Download and Meta Ads files. Falls back to title-only when a
              creator/account name isn&apos;t available.
            </p>
          </div>
          <div className="space-y-2 flex-shrink-0 pt-0.5">
            {NAMING_TEMPLATE_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm text-text-2 cursor-pointer whitespace-nowrap">
                <input
                  type="radio"
                  name="namingTemplate"
                  checked={namingTemplate === opt.value}
                  onChange={() => handleNamingTemplateChange(opt.value)}
                  className="accent-[var(--color-accent)]"
                />
                {opt.label}
                <span className="text-text-3">— {opt.example}</span>
              </label>
            ))}
          </div>
        </div>

        <div className={SETTING_ROW}>
          <div>
            <h4 className="font-medium text-[14px] text-text mb-0.5">Completion sound</h4>
            <p className="text-sm text-text-3">
              Play a short sound when a task finishes. A batch plays one sound when it&apos;s all done.
            </p>
          </div>
          <Switch checked={soundEnabled} onChange={handleToggleSound} label="Completion sound" />
        </div>

        <div className={SETTING_ROW}>
          <div>
            <h4 className="font-medium text-[14px] text-text mb-0.5">About Meta Ad extraction</h4>
            <p className="text-sm text-text-3 max-w-[420px]">
              Meta doesn&apos;t provide an API that returns ad creative files directly, so this
              feature reads the same public Ad Library page a browser would. Meta can change that
              page&apos;s format at any time, which may break extraction until this app is updated.
            </p>
          </div>
        </div>

        <div className={SETTING_ROW}>
          <div>
            <h4 className="font-medium text-[14px] text-text mb-0.5">Diagnostics</h4>
            <p className="text-sm text-text-3">Technical error details are written to a log file.</p>
          </div>
          {isDesktop ? (
            <button onClick={() => window.desktop?.openLogsFolder()} className={`${LINK} flex-shrink-0`}>
              View logs
            </button>
          ) : (
            <p className="text-sm text-text-3 flex-shrink-0">Desktop only</p>
          )}
        </div>
      </div>
    </div>
  );
}
