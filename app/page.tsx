"use client";

import { useState } from "react";
import Header from "@/app/components/Header";
import ModelSetupBanner from "@/app/components/ModelSetupBanner";
import SourceSelector from "@/app/components/SourceSelector";
import YoutubeInput from "@/app/components/YoutubeInput";
import InstagramInput from "@/app/components/InstagramInput";
import DailymotionInput from "@/app/components/DailymotionInput";
import UploadInput from "@/app/components/UploadInput";
import GoogleDriveInput from "@/app/components/GoogleDriveInput";
import ProcessingQueue from "@/app/components/ProcessingQueue";
import TranscriptList from "@/app/components/TranscriptList";
import TranscriptViewer from "@/app/components/TranscriptViewer";
import { useTranscriptionQueue } from "@/app/hooks/useTranscriptionQueue";
import {
  OutputFormat,
  createDailymotionJob,
  createGoogleDriveJob,
  createInstagramJob,
  createUploadJob,
  createYoutubeJob,
} from "@/app/lib/jobs";
import { Mode } from "@/app/lib/uiTypes";

export default function Home() {
  const [mode, setMode] = useState<Mode>("youtube");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("original");
  const [removedJobIds, setRemovedJobIds] = useState<Record<string, true>>({});
  const [viewingJobId, setViewingJobId] = useState<string | null>(null);

  const queue = useTranscriptionQueue();

  const jobs = queue.jobs.filter((j) => !removedJobIds[j.id]);
  const activeJobs = jobs.filter((j) => j.status !== "completed");
  const completedJobs = jobs.filter((j) => j.status === "completed");
  const viewingJob = viewingJobId ? jobs.find((j) => j.id === viewingJobId) ?? null : null;

  function removeJob(id: string) {
    setRemovedJobIds((prev) => ({ ...prev, [id]: true }));
  }

  function clearAllCompleted() {
    setRemovedJobIds((prev) => {
      const next = { ...prev };
      for (const job of queue.jobs) {
        if (job.status === "completed") next[job.id] = true;
      }
      return next;
    });
  }

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <ModelSetupBanner />
          {viewingJob ? (
            <TranscriptViewer
              key={viewingJob.id}
              job={viewingJob}
              onBack={() => setViewingJobId(null)}
            />
          ) : (
            <div className="space-y-10">
              {jobs.length === 0 && (
                <div className="text-center pt-4 pb-2">
                  <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 tracking-tight mb-3">
                    Turn any video into a clean transcript.
                  </h1>
                  <p className="text-gray-500 max-w-lg mx-auto">
                    Transcribe videos from YouTube, Instagram, Dailymotion, your computer, or a
                    public Google Drive folder.
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-500 mb-3">
                  What do you want to transcribe?
                </p>
                <div className="flex flex-col gap-5">
                  <SourceSelector mode={mode} onChange={setMode} />

                  <div className="rounded-lg border border-gray-200 bg-white p-6">
                    {mode === "youtube" && (
                      <YoutubeInput
                        onSubmit={(url) => queue.addJobs([createYoutubeJob(url, outputFormat)])}
                      />
                    )}
                    {mode === "instagram" && (
                      <InstagramInput
                        outputFormat={outputFormat}
                        onOutputFormatChange={setOutputFormat}
                        onSubmit={(url) =>
                          queue.addJobs([createInstagramJob(url, outputFormat)])
                        }
                      />
                    )}
                    {mode === "dailymotion" && (
                      <DailymotionInput
                        outputFormat={outputFormat}
                        onOutputFormatChange={setOutputFormat}
                        onSubmit={(url) =>
                          queue.addJobs([createDailymotionJob(url, outputFormat)])
                        }
                      />
                    )}
                    {mode === "upload" && (
                      <UploadInput
                        outputFormat={outputFormat}
                        onOutputFormatChange={setOutputFormat}
                        onSubmit={(files) =>
                          queue.addJobs(files.map((f) => createUploadJob(f, outputFormat)))
                        }
                      />
                    )}
                    {mode === "drive" && (
                      <GoogleDriveInput
                        outputFormat={outputFormat}
                        onOutputFormatChange={setOutputFormat}
                        onSubmit={(files, resourceKey) =>
                          queue.addJobs(
                            files.map((f) => createGoogleDriveJob(f, resourceKey, outputFormat))
                          )
                        }
                      />
                    )}
                  </div>
                </div>
              </div>

              {activeJobs.length > 0 && (
                <ProcessingQueue
                  jobs={activeJobs}
                  isProcessing={queue.isProcessing}
                  onCancel={queue.cancelProcessing}
                  onResume={queue.resume}
                  onRetryFailed={queue.retryFailed}
                  onRetryJob={queue.retryJob}
                />
              )}

              {jobs.length > 0 && (
                <TranscriptList
                  jobs={completedJobs}
                  isProcessing={queue.isProcessing}
                  onOpen={setViewingJobId}
                  onRemove={removeJob}
                  onClearAll={clearAllCompleted}
                />
              )}
            </div>
          )}
        </div>
      </main>
      <footer className="py-6 text-center text-xs text-gray-400">Made with ♥ by Abhay</footer>
    </>
  );
}
