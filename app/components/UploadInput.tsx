"use client";

import { useRef, useState } from "react";
import { OutputFormat } from "@/app/lib/jobs";
import { isAllowedUploadFile, UPLOAD_ALLOWED_EXTENSIONS } from "@/app/lib/uploadFormats";
import OutputFormatToggle from "@/app/components/OutputFormatToggle";
import { DROPZONE, BTN_GHOST, BTN_PRIMARY } from "@/app/lib/uiStyles";

const FILE_INPUT_ACCEPT = UPLOAD_ALLOWED_EXTENSIONS.join(",");

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
      setError("Please select at least one video or audio file.");
      return;
    }
    if (files.some((f) => !isAllowedUploadFile(f.name))) {
      setError("Please select only supported video or audio files.");
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
        className={`${DROPZONE} ${isDragging ? "border-accent text-accent bg-accent-soft shadow-[0_0_40px_-12px_var(--color-accent-glow)_inset]" : ""}`}
      >
        <p className="text-text font-medium mb-1">Drag &amp; drop video or audio files here</p>
        <p className="text-sm text-text-3 mb-4">or</p>
        <button type="button" onClick={() => inputRef.current?.click()} className={BTN_GHOST}>
          Choose Files
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={FILE_INPUT_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        <p className="text-xs text-text-3 mt-4">
          MP4, MOV, MP3, WAV, M4A, AAC, FLAC, OGG, OPUS, WMA, and other supported formats
        </p>
      </div>

      {files.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-text-2 mb-2">
            {files.length} file{files.length === 1 ? "" : "s"} selected
          </p>
          <ul className="text-sm text-text-2 space-y-0.5 mb-4 max-h-36 overflow-y-auto">
            {files.map((f, i) => (
              <li key={i} className="truncate">
                {f.name}
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between">
            <OutputFormatToggle value={outputFormat} onChange={onOutputFormatChange} />
            <button onClick={handleSubmit} className={BTN_PRIMARY}>
              Start Transcription
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-danger mt-3">{error}</p>}
    </div>
  );
}
