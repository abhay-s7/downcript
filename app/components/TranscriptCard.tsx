"use client";

import { TranscriptionJob } from "@/app/lib/jobs";
import { formatTranscriptAsParagraphs } from "@/app/lib/export";
import { countWords, formatWordCount, getPreviewText } from "@/app/lib/textPreview";
import ExportMenu from "@/app/components/ExportMenu";

function sanitizeFileBaseName(name: string): string {
  const withoutExtension = name.replace(/\.[^/.]+$/, "");
  const sanitized = withoutExtension.replace(/[\\/:*?"<>|]/g, "_").trim();
  return sanitized || "transcript";
}

export default function TranscriptCard({
  job,
  onOpen,
  onRemove,
}: {
  job: TranscriptionJob;
  onOpen: () => void;
  onRemove: () => void;
}) {
  if (!job.transcript) return null;

  const paragraphs = formatTranscriptAsParagraphs(job.transcript);
  const preview = getPreviewText(paragraphs);
  const words = countWords(job.transcript);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 flex flex-col gap-3">
      <p className="font-medium text-gray-900 truncate">{job.fileName}</p>

      <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
        {preview || "No speech detected."}
      </p>

      <p className="text-xs text-gray-400">{formatWordCount(words)}</p>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onOpen}
          className="text-sm font-medium px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Open Transcript
        </button>
        <ExportMenu
          title={job.fileName}
          fileBaseName={sanitizeFileBaseName(job.fileName)}
          segments={job.transcript}
        />
        <button
          onClick={onRemove}
          aria-label="Remove transcript"
          className="ml-auto text-gray-400 hover:text-gray-700 transition-colors w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}
