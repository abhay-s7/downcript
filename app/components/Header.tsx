"use client";

import { useState } from "react";
import { Section } from "@/app/lib/uiTypes";

const NAV_ITEMS: Array<{ section: Section; label: string }> = [
  { section: "download", label: "Download" },
  { section: "transcript", label: "Transcript" },
  { section: "meta", label: "Meta Ads" },
  { section: "settings", label: "Settings" },
];

export default function Header({
  section,
  onNavigate,
}: {
  section: Section;
  onNavigate: (section: Section) => void;
}) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            onClick={() => onNavigate("home")}
            className="text-[15px] font-semibold tracking-tight text-gray-900"
          >
            Downcript
          </button>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.section}
                onClick={() => onNavigate(item.section)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  section === item.section
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="relative">
          <button
            onClick={() => setHelpOpen((o) => !o)}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            Help
          </button>
          {helpOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setHelpOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-lg z-20 text-sm text-gray-600 leading-relaxed">
                <p className="font-medium text-gray-900 mb-1">How this works</p>
                <p>
                  <strong>Download</strong> fetches media from YouTube, Instagram, and other
                  supported sites. <strong>Transcript</strong> turns any video into readable
                  text, processed locally on this machine. <strong>Meta Ads</strong> pulls the
                  video, image, or carousel creative from a Meta Ad Library link. Each section
                  has its own queue, so you can start several jobs and they run one at a time.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
