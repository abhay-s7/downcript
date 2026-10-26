"use client";

import { useState } from "react";
import { Section } from "@/app/lib/uiTypes";
import { useLibrary } from "@/app/hooks/useLibrary";
import { useOutputDir } from "@/app/hooks/useOutputDir";

const NAV_ITEMS: Array<{ section: Section; label: string; icon: React.ReactNode }> = [
  {
    section: "download",
    label: "Download",
    icon: <path d="M10 3v10M6 9.5l4 4 4-4M4 16.5h12" />,
  },
  {
    section: "transcript",
    label: "Transcript",
    icon: <path d="M4 5h12M4 9h12M4 13h7" />,
  },
  {
    section: "meta",
    label: "Meta Ads",
    icon: <path d="M3 11l10-6v10L3 11zM13 7.5c2 .5 3 1.5 3 2.5s-1 2-3 2.5M5 12.5l1 4h2l-.7-3" />,
  },
];

function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

export default function Sidebar({
  section,
  onNavigate,
}: {
  section: Section;
  onNavigate: (section: Section) => void;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const lib = useLibrary();
  const { outputDir } = useOutputDir();

  // A rough, purely visual sense of "how full" the library feels -- not a
  // real quota (this is a local folder, not a capped storage plan) -- capped
  // well under 100% so the meter never looks oddly almost-full for a
  // normal-sized library.
  const meterPct = Math.min(90, Math.round((lib.totalSizeBytes / (500 * 1024 * 1024)) * 100));

  return (
    <aside className="flex flex-col gap-1.5 p-5 border-r border-line bg-gradient-to-b from-white to-white/40">
      <button
        onClick={() => onNavigate("home")}
        className="flex items-center gap-2.5 px-2.5 pb-5 pt-1 font-semibold text-[16px] tracking-tight text-text text-left"
      >
        <span className="w-[30px] h-[30px] rounded-[9px] grid place-items-center flex-shrink-0 bg-gradient-to-br from-accent to-accent-2 shadow-[0_0_24px_var(--color-accent-glow),0_1px_0_rgba(255,255,255,.35)_inset]">
          <svg viewBox="0 0 16 16" className="w-[15px] h-[15px] stroke-white fill-none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v8M4.5 7L8 10.5 11.5 7M3 13.5h10" />
          </svg>
        </span>
        Downcript
      </button>

      <div className="font-mono text-[10.5px] tracking-[.14em] uppercase text-text-3 px-3 pt-2.5 pb-1.5">Workspace</div>
      <nav role="tablist" aria-label="Sections" className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = section === item.section;
          return (
            <button
              key={item.section}
              role="tab"
              aria-selected={active}
              onClick={() => onNavigate(item.section)}
              className={`relative flex items-center gap-3 w-full px-3 py-2.5 rounded-[10px] text-left font-[450] transition-colors ${
                active
                  ? "bg-surface-3 text-text shadow-[0_0_0_1px_var(--color-line-2)_inset]"
                  : "text-text-2 hover:bg-black/[.04] hover:text-text"
              }`}
            >
              {active && (
                <span className="absolute -left-[14px] top-[9px] bottom-[9px] w-[3px] rounded-r-[3px] bg-accent shadow-[0_0_12px_var(--color-accent-glow)]" />
              )}
              <svg viewBox="0 0 20 20" className="w-[17px] h-[17px] stroke-current fill-none flex-shrink-0" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                {item.icon}
              </svg>
              {item.label}
            </button>
          );
        })}
        <button
          role="tab"
          aria-selected={section === "library"}
          onClick={() => onNavigate("library")}
          className={`relative flex items-center gap-3 w-full px-3 py-2.5 rounded-[10px] text-left font-[450] transition-colors ${
            section === "library"
              ? "bg-surface-3 text-text shadow-[0_0_0_1px_var(--color-line-2)_inset]"
              : "text-text-2 hover:bg-black/[.04] hover:text-text"
          }`}
        >
          {section === "library" && (
            <span className="absolute -left-[14px] top-[9px] bottom-[9px] w-[3px] rounded-r-[3px] bg-accent shadow-[0_0_12px_var(--color-accent-glow)]" />
          )}
          <svg viewBox="0 0 20 20" className="w-[17px] h-[17px] stroke-current fill-none flex-shrink-0" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="14" height="12" rx="2.5" />
            <path d="M3 8.5h14" />
          </svg>
          Library
          {lib.totalCount > 0 && <span className="ml-auto font-mono text-[11px] text-text-3">{lib.totalCount}</span>}
        </button>
      </nav>

      <div className="font-mono text-[10.5px] tracking-[.14em] uppercase text-text-3 px-3 pt-2.5 pb-1.5">System</div>
      <button
        role="tab"
        aria-selected={section === "settings"}
        onClick={() => onNavigate("settings")}
        className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-[10px] text-left font-[450] transition-colors ${
          section === "settings"
            ? "bg-surface-3 text-text shadow-[0_0_0_1px_var(--color-line-2)_inset]"
            : "text-text-2 hover:bg-black/[.04] hover:text-text"
        }`}
      >
        <svg viewBox="0 0 20 20" className="w-[17px] h-[17px] stroke-current fill-none flex-shrink-0" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="10" r="2.5" />
          <path d="M10 3v2M10 15v2M3 10h2M15 10h2M5 5l1.4 1.4M13.6 13.6L15 15M15 5l-1.4 1.4M6.4 13.6L5 15" />
        </svg>
        Settings
      </button>

      <div className="relative">
        <button
          onClick={() => setHelpOpen((o) => !o)}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-[10px] text-left font-[450] text-text-2 hover:bg-black/[.04] hover:text-text transition-colors"
        >
          <svg viewBox="0 0 20 20" className="w-[17px] h-[17px] stroke-current fill-none flex-shrink-0" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="10" cy="10" r="7" />
            <path d="M8 8a2 2 0 114 0c0 1.2-2 1.6-2 3M10 14v.01" />
          </svg>
          Help
        </button>
        {helpOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setHelpOpen(false)} />
            <div className="absolute left-full bottom-0 ml-2 w-80 rounded-2xl border border-line bg-surface p-4 shadow-[0_40px_80px_-20px_rgba(20,24,40,.35)] z-20 text-sm text-text-2 leading-relaxed">
              <p className="font-medium text-text mb-1">How this works</p>
              <p>
                <strong>Download</strong> fetches media from YouTube, Instagram, and other supported
                sites. <strong>Transcript</strong> turns any video into readable text, processed locally
                on this machine. <strong>Meta Ads</strong> pulls the video, image, or carousel creative
                from a Meta Ad Library link. <strong>Library</strong> collects everything you&apos;ve
                downloaded or generated in one searchable place. Each section has its own queue, so you
                can start several jobs at once (Download runs a few at a time; the rest one at a time).
              </p>
            </div>
          </>
        )}
      </div>

      <div className="flex-1" />

      <div className="p-3.5 rounded-[14px] bg-surface border border-line">
        <div className="flex justify-between text-xs text-text-2 mb-2.5">
          <span>Library size</span>
          <span>{formatBytes(lib.totalSizeBytes)}</span>
        </div>
        <div className="h-[5px] rounded-full bg-surface-3 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${Math.max(meterPct, 3)}%` }} />
        </div>
        <small className="block mt-2.5 text-text-3 text-[11.5px] truncate">{outputDir || "Downloads/Downcript"}</small>
      </div>
      <div className="flex justify-between items-center px-2.5 pt-3 text-text-3 text-xs">
        <span>
          Made with <span className="text-[#FF7A9C]">♥</span> by Abhay
        </span>
        <span>v1.1.0</span>
      </div>
    </aside>
  );
}
