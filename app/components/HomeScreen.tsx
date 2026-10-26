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
    <div className="pt-2">
      <p className="font-mono text-[11px] tracking-[.14em] uppercase text-accent mt-3 mb-3.5">Home</p>
      <h1 className="font-medium text-[clamp(32px,4vw,46px)] leading-[1.05] tracking-[-.04em] mb-5">
        <span className="bg-gradient-to-r from-text from-20% to-text-3 bg-clip-text text-transparent">
          Download, transcribe, and extract — in one app.
        </span>
      </h1>
      <p className="text-text-2 text-[15.5px] max-w-[540px] mb-10">Pick a starting point below.</p>

      <div className="grid gap-4 sm:grid-cols-3">
        {ACTIONS.map((action) => (
          <button
            key={action.section}
            onClick={() => onNavigate(action.section)}
            className="text-left bg-surface border border-line rounded-2xl p-6 shadow-[0_1px_2px_rgba(20,24,40,.04)] transition-all hover:border-line-2 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-20px_rgba(20,24,40,.22),0_0_40px_-20px_var(--color-accent-glow)]"
          >
            <h2 className="text-[15px] font-semibold text-text mb-1.5">{action.title}</h2>
            <p className="text-sm text-text-2 leading-relaxed">{action.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
