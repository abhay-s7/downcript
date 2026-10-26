"use client";

import { useState } from "react";
import { LABEL, INPUT, BTN_PRIMARY } from "@/app/lib/uiStyles";

export default function MetaAdInput({ onSubmit }: { onSubmit: (url: string) => void }) {
  const [url, setUrl] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    onSubmit(url.trim());
    setUrl("");
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className={LABEL}>Meta Ad Library URL</label>
      <div className="flex gap-2.5">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.facebook.com/ads/library/?id=…"
          className={INPUT}
          required
        />
        <button type="submit" className={BTN_PRIMARY}>
          Analyze
        </button>
      </div>
    </form>
  );
}
