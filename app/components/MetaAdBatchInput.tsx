"use client";

import { useRef, useState } from "react";
import { BatchUrlEntry, BatchUrlStatus, classifyBatchInput } from "@/app/lib/services/meta/batchParse";
import { BTN_PRIMARY_SM, BTN_GHOST_SM, LINK, DIVIDER } from "@/app/lib/uiStyles";

const STATUS_BADGE: Record<BatchUrlStatus, string> = {
  valid: "bg-ok-soft text-ok",
  duplicate: "bg-warn-soft text-warn",
  invalid: "bg-danger-soft text-danger",
  unsupported: "bg-danger-soft text-danger",
};
const STATUS_LABEL: Record<BatchUrlStatus, string> = {
  valid: "Valid",
  duplicate: "Duplicate",
  invalid: "Invalid",
  unsupported: "Unsupported",
};

function countByStatus(entries: BatchUrlEntry[], status: BatchUrlStatus): number {
  return entries.filter((e) => e.status === status).length;
}

export default function MetaAdBatchInput({
  existingAdIds,
  onAddUrls,
}: {
  existingAdIds: ReadonlySet<string>;
  onAddUrls: (urls: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<BatchUrlEntry[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePreview() {
    setPreview(classifyBatchInput(text, existingAdIds));
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be re-imported later if needed
    if (!file) return;
    const content = await file.text();
    setText((prev) => (prev.trim() ? `${prev}\n${content}` : content));
    setPreview(null);
  }

  function handleAddToQueue() {
    if (!preview) return;
    const urls = preview.filter((e) => e.status === "valid").map((e) => e.raw);
    if (urls.length === 0) return;
    onAddUrls(urls);
    setText("");
    setPreview(null);
  }

  if (!expanded) {
    return (
      <>
        <div className={DIVIDER} />
        <button onClick={() => setExpanded(true)} className={LINK}>
          + Batch add multiple ads
        </button>
      </>
    );
  }

  const total = preview?.length ?? 0;
  const valid = preview ? countByStatus(preview, "valid") : 0;
  const duplicate = preview ? countByStatus(preview, "duplicate") : 0;
  const invalid = preview ? countByStatus(preview, "invalid") : 0;
  const unsupported = preview ? countByStatus(preview, "unsupported") : 0;

  return (
    <>
      <div className={DIVIDER} />
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-text-2">Batch add multiple ads</label>
        <div className="flex items-center gap-3">
          <button onClick={() => fileInputRef.current?.click()} className={LINK}>
            Import TXT/CSV
          </button>
          <button
            onClick={() => {
              setExpanded(false);
              setText("");
              setPreview(null);
            }}
            className="text-sm text-text-3 hover:text-text transition-colors"
          >
            Close
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept=".txt,.csv,text/plain,text/csv" onChange={handleImport} className="hidden" />
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPreview(null);
        }}
        placeholder={
          "Paste multiple Meta Ad Library URLs — one per line (or separated by spaces/commas)\nhttps://www.facebook.com/ads/library/?id=...\nhttps://www.facebook.com/ads/library/?id=..."
        }
        rows={4}
        className="w-full rounded-[10px] border border-line-2 bg-white px-3.5 py-2.5 text-sm font-mono placeholder:text-text-3 shadow-[0_1px_2px_rgba(20,24,40,.05)_inset] transition-colors focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft"
      />

      <div className="mt-2.5 flex items-center gap-2">
        <button onClick={handlePreview} disabled={!text.trim()} className={BTN_GHOST_SM}>
          Preview
        </button>
        {preview && (
          <button onClick={handleAddToQueue} disabled={valid === 0} className={BTN_PRIMARY_SM}>
            Add {valid} to queue
          </button>
        )}
      </div>

      {preview && (
        <div className="mt-3">
          <p className="text-sm text-text-2 mb-2">
            {total} URL{total === 1 ? "" : "s"} found — {valid} valid, {duplicate} duplicate, {invalid} invalid,{" "}
            {unsupported} unsupported.
          </p>
          {total > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-[10px] border border-line divide-y divide-line">
              {preview.map((entry, i) => (
                <div key={i} className="px-3 py-1.5 text-xs flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 font-medium flex-shrink-0 ${STATUS_BADGE[entry.status]}`}>
                    {STATUS_LABEL[entry.status]}
                  </span>
                  <span className="truncate flex-1 text-text-2" title={entry.raw}>
                    {entry.raw}
                  </span>
                  {entry.status !== "valid" && entry.reason && (
                    <span className="text-text-3 flex-shrink-0">{entry.reason}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
