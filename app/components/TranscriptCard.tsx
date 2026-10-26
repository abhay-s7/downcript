"use client";

import { TranscriptionJob } from "@/app/lib/jobs";
import { formatTranscriptAsParagraphs } from "@/app/lib/export";
import { countWords, formatWordCount, getPreviewText } from "@/app/lib/textPreview";
import { sanitizeFileBaseName } from "@/app/lib/services/filesystem/naming";
import ExportMenu from "@/app/components/ExportMenu";
import { CARD, BTN_OUTLINE } from "@/app/lib/uiStyles";

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
    <div className={`${CARD} p-5 flex flex-col gap-3`}>
      <p className="font-medium text-text truncate">{job.fileName}</p>

      <p className="text-sm text-text-2 leading-relaxed line-clamp-2">
        {preview || "No speech detected."}
      </p>

      <p className="text-xs text-text-3 font-mono">{formatWordCount(words)}</p>

      <div className="flex items-center gap-2 pt-1">
        <button onClick={onOpen} className={BTN_OUTLINE}>
          Open Transcript
        </button>
        <ExportMenu
          title={job.fileName}
          fileBaseName={sanitizeFileBaseName(job.fileName)}
          segments={job.transcript}
          includeTimestamps={job.includeTimestamps}
        />
        <button
          onClick={onRemove}
          aria-label="Remove transcript"
          className="ml-auto text-text-3 hover:text-text transition-colors w-7 h-7 flex items-center justify-center rounded-[9px] hover:bg-surface-3"
        >
          ×
        </button>
      </div>
    </div>
  );
}
