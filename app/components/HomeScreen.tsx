"use client";

import { Section } from "@/app/lib/uiTypes";

const ACTIONS: Array<{ section: Section; title: string; description: string }> = [
  {
    section: "download",
    title: "Download Media",
    description: "Paste a link from YouTube, Instagram, and more — pick a quality and save it.",
  },
  {
    section: "transcript",
    title: "Generate Transcript",
    description: "Turn a video into a clean, readable transcript — TXT, DOCX, or SRT.",
  },
  {
    section: "meta",
    title: "Extract Meta Ad",
    description: "Paste a Meta Ad Library link to pull its video, image, or carousel creatives.",
  },
];

export default function HomeScreen({ onNavigate }: { onNavigate: (section: Section) => void }) {
  return (
    <div className="pt-4">
      <div className="text-center pb-10">
        <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 tracking-tight mb-3">
          Download, transcribe, and extract — in one app.
        </h1>
        <p className="text-gray-500 max-w-lg mx-auto">Pick a starting point below.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {ACTIONS.map((action) => (
          <button
            key={action.section}
            onClick={() => onNavigate(action.section)}
            className="text-left rounded-lg border border-gray-200 bg-white p-6 hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <h2 className="text-base font-semibold text-gray-900 mb-1.5">{action.title}</h2>
            <p className="text-sm text-gray-500 leading-relaxed">{action.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
