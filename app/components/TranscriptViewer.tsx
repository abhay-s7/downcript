"use client";

import { useState } from "react";
import { OutputFormat, TranscriptionJob } from "@/app/lib/jobs";
import { formatTranscriptAsParagraphs } from "@/app/lib/export";
import ExportMenu from "@/app/components/ExportMenu";

function sanitizeFileBaseName(name: string): string {
  const withoutExtension = name.replace(/\.[^/.]+$/, "");
  const sanitized = withoutExtension.replace(/[\\/:*?"<>|]/g, "_").trim();
  return sanitized || "transcript";
}

function highlight(text: string, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part));
}

export default function TranscriptViewer({
  job,
  onBack,
}: {
  job: TranscriptionJob;
  onBack: () => void;
}) {
  const availableOriginal = job.outputFormat === "original" || !!job.originalTranscript;
  const availableHinglish = job.outputFormat === "hinglish";

  const [viewFormat, setViewFormat] = useState<OutputFormat>(job.outputFormat);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  if (!job.transcript) return null;

  const activeSegments =
    viewFormat === job.outputFormat ? job.transcript : job.originalTranscript ?? job.transcript;
  const paragraphs = formatTranscriptAsParagraphs(activeSegments);

  const trimmedQuery = query.trim().toLowerCase();
  const hasAnyMatch = !trimmedQuery || paragraphs.some((p) => p.toLowerCase().includes(trimmedQuery));

  function handleCopy() {
    navigator.clipboard
      .writeText(paragraphs.join("\n\n"))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8">
      <button
        onClick={onBack}
        className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors mb-4"
      >
        ← Back to Transcripts
      </button>

      <div className="flex items-center justify-between mb-4 gap-4">
        <h1 className="text-lg font-semibold text-gray-900 truncate">{job.fileName}</h1>

        <div className="inline-flex rounded-md border border-gray-200 p-0.5 shrink-0">
          <button
            onClick={() => setViewFormat("original")}
            disabled={!availableOriginal}
            title={!availableOriginal ? "Original text isn't available for this transcript." : undefined}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              viewFormat === "original" ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Original
          </button>
          <button
            onClick={() => setViewFormat("hinglish")}
            disabled={!availableHinglish}
            title={!availableHinglish ? "This transcript wasn't generated as Hinglish." : undefined}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              viewFormat === "hinglish" ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Hinglish
          </button>
        </div>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search transcript..."
        className="w-full rounded-md border border-gray-300 px-3.5 py-2 text-sm mb-6 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />

      <div className="max-w-[720px] mx-auto">
        {!hasAnyMatch ? (
          <p className="text-gray-400 text-center py-10">No matching text found.</p>
        ) : (
          <div className="space-y-5 text-[17px] leading-[1.8] text-gray-800">
            {paragraphs.map((p, i) => (
              <p key={i}>{highlight(p, query)}</p>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100 max-w-[720px] mx-auto">
        <button
          onClick={handleCopy}
          className="text-sm font-medium px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {copied ? "Copied ✓" : "Copy Transcript"}
        </button>
        <ExportMenu
          title={job.fileName}
          fileBaseName={sanitizeFileBaseName(job.fileName)}
          segments={activeSegments}
        />
      </div>
    </div>
  );
}
