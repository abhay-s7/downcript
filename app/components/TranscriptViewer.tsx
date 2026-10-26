"use client";

import { useState } from "react";
import { OutputFormat, TranscriptionJob } from "@/app/lib/jobs";
import { formatTimestampLabel, formatTranscriptAsParagraphsWithTimestamps } from "@/app/lib/export";
import { sanitizeFileBaseName } from "@/app/lib/services/filesystem/naming";
import ExportMenu from "@/app/components/ExportMenu";
import { CARD, INPUT, BTN_OUTLINE, SEG, SEG_BTN, SEG_BTN_ON } from "@/app/lib/uiStyles";

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
  const paragraphs = formatTranscriptAsParagraphsWithTimestamps(activeSegments);

  // Search matches against each paragraph's actual text only -- never
  // against the timestamp label -- so searching e.g. "12" never matches a
  // "[00:00:12]" marker instead of real transcript wording.
  const trimmedQuery = query.trim().toLowerCase();
  const hasAnyMatch = !trimmedQuery || paragraphs.some((p) => p.text.toLowerCase().includes(trimmedQuery));

  function handleCopy() {
    const text = job.includeTimestamps
      ? paragraphs.map((p) => `[${formatTimestampLabel(p.start)}] ${p.text}`).join("\n\n")
      : paragraphs.map((p) => p.text).join("\n\n");
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  return (
    <div className={`${CARD} p-8`}>
      <button onClick={onBack} className="text-sm font-medium text-text-2 hover:text-text transition-colors mb-4">
        ← Back to Transcripts
      </button>

      <div className="flex items-center justify-between mb-4 gap-4">
        <h1 className="text-lg font-semibold text-text truncate">{job.fileName}</h1>

        <div className={`${SEG} shrink-0`}>
          <button
            onClick={() => setViewFormat("original")}
            disabled={!availableOriginal}
            title={!availableOriginal ? "Original text isn't available for this transcript." : undefined}
            className={`disabled:opacity-30 disabled:cursor-not-allowed ${viewFormat === "original" ? SEG_BTN_ON : SEG_BTN}`}
          >
            Original
          </button>
          <button
            onClick={() => setViewFormat("hinglish")}
            disabled={!availableHinglish}
            title={!availableHinglish ? "This transcript wasn't generated as Hinglish." : undefined}
            className={`disabled:opacity-30 disabled:cursor-not-allowed ${viewFormat === "hinglish" ? SEG_BTN_ON : SEG_BTN}`}
          >
            Hinglish
          </button>
        </div>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search transcript…"
        className={`${INPUT} mb-6`}
      />

      <div className="max-w-[720px] mx-auto">
        {!hasAnyMatch ? (
          <p className="text-text-3 text-center py-10">No matching text found.</p>
        ) : (
          <div className="space-y-5 text-[17px] leading-[1.8] text-text-2">
            {paragraphs.map((p, i) => (
              <p key={i}>
                {job.includeTimestamps && (
                  <span className="text-text-3 text-sm font-mono mr-2 select-all">
                    [{formatTimestampLabel(p.start)}]
                  </span>
                )}
                {highlight(p.text, query)}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-8 pt-6 border-t border-line max-w-[720px] mx-auto">
        <button onClick={handleCopy} className={BTN_OUTLINE}>
          {copied ? "Copied ✓" : "Copy Transcript"}
        </button>
        <ExportMenu
          title={job.fileName}
          fileBaseName={sanitizeFileBaseName(job.fileName)}
          segments={activeSegments}
          includeTimestamps={job.includeTimestamps}
        />
      </div>
    </div>
  );
}
