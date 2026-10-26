"use client";

import { useState } from "react";
import { LABEL, INPUT, BTN_PRIMARY } from "@/app/lib/uiStyles";

export default function YoutubeInput({ onSubmit }: { onSubmit: (url: string) => void }) {
  const [url, setUrl] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    onSubmit(url);
    setUrl("");
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className={LABEL}>YouTube Video URL</label>
      <div className="flex gap-2.5">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          className={INPUT}
          required
        />
        <button type="submit" className={BTN_PRIMARY}>
          Transcribe
        </button>
      </div>
    </form>
  );
}
