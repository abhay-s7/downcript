"use client";

import { useState } from "react";
import { TranscriptionJob } from "@/app/lib/jobs";
import { ExportableVideo } from "@/app/lib/export";
import TranscriptCard from "@/app/components/TranscriptCard";
import ExportAllMenu from "@/app/components/ExportAllMenu";
import ConfirmDialog from "@/app/components/ConfirmDialog";

export default function TranscriptList({
  jobs,
  isProcessing,
  onOpen,
  onRemove,
  onClearAll,
}: {
  jobs: TranscriptionJob[];
  isProcessing: boolean;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const exportableVideos: ExportableVideo[] = jobs
    .filter((j) => j.transcript)
    .map((j) => ({ title: j.fileName, segments: j.transcript!, includeTimestamps: j.includeTimestamps }));

  function handleClearAllClick() {
    if (isProcessing) return;
    setConfirmOpen(true);
  }

  function handleConfirm() {
    onClearAll();
    setConfirmOpen(false);
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Transcripts ({jobs.length})</h2>
        {jobs.length > 0 && (
          <div className="flex items-center gap-2">
            <ExportAllMenu videos={exportableVideos} />
            <button
              onClick={handleClearAllClick}
              disabled={isProcessing}
              title={
                isProcessing
                  ? "Processing is currently active. Cancel processing before clearing transcripts."
                  : undefined
              }
              className="text-sm font-medium px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {confirmOpen && (
        <div className="mb-4">
          {isProcessing ? (
            <ConfirmDialog
              title="Processing is currently active"
              message="Cancel processing before clearing transcripts."
              confirmLabel="OK"
              onConfirm={() => setConfirmOpen(false)}
              onCancel={() => setConfirmOpen(false)}
            />
          ) : (
            <ConfirmDialog
              title="Clear all transcripts?"
              message="This will remove the current transcript results from the workspace."
              confirmLabel="Clear All"
              danger
              onConfirm={handleConfirm}
              onCancel={() => setConfirmOpen(false)}
            />
          )}
        </div>
      )}

      {jobs.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center border border-dashed border-gray-200 rounded-lg">
          No transcripts yet. Choose a source above to get started.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {jobs.map((job) => (
            <TranscriptCard
              key={job.id}
              job={job}
              onOpen={() => onOpen(job.id)}
              onRemove={() => onRemove(job.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
