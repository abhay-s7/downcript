"use client";

import { useState } from "react";
import { extractInstagramReelId } from "@/app/lib/instagram";
import { OutputFormat } from "@/app/lib/jobs";
import OutputFormatToggle from "@/app/components/OutputFormatToggle";
import { LABEL, INPUT, BTN_PRIMARY } from "@/app/lib/uiStyles";

export default function InstagramInput({
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
    if (!extractInstagramReelId(url)) {
      setError("Please enter a valid Instagram Reel URL.");
      return;
    }
    setError("");
    onSubmit(url);
    setUrl("");
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className={LABEL}>Instagram Reel URL</label>
      <div className="flex gap-2.5 mb-3.5">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.instagram.com/reel/…"
          className={INPUT}
          required
        />
        <button type="submit" className={BTN_PRIMARY}>
          Transcribe
        </button>
      </div>

      {error && <p className="text-sm text-danger mb-3.5">{error}</p>}

      <OutputFormatToggle value={outputFormat} onChange={onOutputFormatChange} />
    </form>
  );
}
