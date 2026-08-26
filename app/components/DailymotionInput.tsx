"use client";

import { useState } from "react";
import { extractDailymotionVideoId } from "@/app/lib/dailymotion";
import { OutputFormat } from "@/app/lib/jobs";
import OutputFormatToggle from "@/app/components/OutputFormatToggle";

export default function DailymotionInput({
  outputFormat,
  onOutputFormatChange,
  onSubmit,
}: {
  outputFormat: OutputFormat;
  onOutputFormatChange: (format: OutputFormat) => void;
  onSubmit: (url: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!extractDailymotionVideoId(url)) {
      setError("Please enter a valid Dailymotion video URL.");
      return;
    }
    setError("");
    onSubmit(url);
    setUrl("");
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        Dailymotion Video URL
      </label>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.dailymotion.com/video/..."
          className="flex-1 rounded-md border border-gray-300 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
        <button
          type="submit"
          className="rounded-md bg-blue-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Transcribe
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <OutputFormatToggle value={outputFormat} onChange={onOutputFormatChange} />
    </form>
  );
}
