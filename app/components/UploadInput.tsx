"use client";

import { useRef, useState } from "react";
import { OutputFormat } from "@/app/lib/jobs";
import OutputFormatToggle from "@/app/components/OutputFormatToggle";

export default function UploadInput({
  outputFormat,
  onOutputFormatChange,
  onSubmit,
}: {
  outputFormat: OutputFormat;
  onOutputFormatChange: (format: OutputFormat) => void;
  onSubmit: (files: File[]) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | File[]) {
    setFiles(Array.from(list));
    setError("");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }

  function handleSubmit() {
    if (files.length === 0) {
      setError("Please select at least one video.");
      return;
    }
    if (files.some((f) => !f.name.toLowerCase().endsWith(".mp4"))) {
      setError("Please select only MP4 videos.");
      return;
    }
    setError("");
    onSubmit(files);
    setFiles([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50"
        }`}
      >
        <p className="text-gray-700 font-medium mb-1">Drag &amp; drop videos here</p>
        <p className="text-sm text-gray-400 mb-4">or</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Choose Files
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,.mp4"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        <p className="text-xs text-gray-400 mt-4">MP4 files, one or more at a time</p>
      </div>

      {files.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">
            {files.length} video{files.length === 1 ? "" : "s"} selected
          </p>
          <ul className="text-sm text-gray-600 space-y-0.5 mb-4 max-h-36 overflow-y-auto">
            {files.map((f, i) => (
              <li key={i} className="truncate">
                {f.name}
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between">
            <OutputFormatToggle value={outputFormat} onChange={onOutputFormatChange} />
            <button
              onClick={handleSubmit}
              className="rounded-md bg-blue-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Start Transcription
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  );
}
