"use client";

import { useRef, useState } from "react";
import { BatchUrlEntry, BatchUrlStatus, classifyBatchInput } from "@/app/lib/services/meta/batchParse";

const PRIMARY_BUTTON =
  "inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed";
const SECONDARY_BUTTON =
  "inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-medium transition-colors border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:bg-white disabled:border-gray-200 disabled:text-gray-300 disabled:cursor-not-allowed";

const STATUS_BADGE: Record<BatchUrlStatus, string> = {
  valid: "bg-green-50 text-green-700",
  duplicate: "bg-amber-50 text-amber-700",
  invalid: "bg-red-50 text-red-700",
  unsupported: "bg-red-50 text-red-700",
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
      <div className="mt-3 pt-3 border-t border-gray-100">
        <button onClick={() => setExpanded(true)} className="text-sm text-blue-600 hover:underline">
          Batch add multiple ads
        </button>
      </div>
    );
  }

  const total = preview?.length ?? 0;
  const valid = preview ? countByStatus(preview, "valid") : 0;
  const duplicate = preview ? countByStatus(preview, "duplicate") : 0;
  const invalid = preview ? countByStatus(preview, "invalid") : 0;
  const unsupported = preview ? countByStatus(preview, "unsupported") : 0;

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-gray-700">Batch add multiple ads</label>
        <div className="flex items-center gap-3">
          <button onClick={() => fileInputRef.current?.click()} className="text-sm text-blue-600 hover:underline">
            Import TXT/CSV
          </button>
          <button
            onClick={() => {
              setExpanded(false);
              setText("");
              setPreview(null);
            }}
            className="text-sm text-gray-400 hover:text-gray-700"
          >
            Close
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.csv,text/plain,text/csv"
          onChange={handleImport}
          className="hidden"
        />
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
        className="w-full rounded-md border border-gray-300 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
      />

      <div className="mt-2 flex items-center gap-2">
        <button onClick={handlePreview} disabled={!text.trim()} className={SECONDARY_BUTTON}>
          Preview
        </button>
        {preview && (
          <button onClick={handleAddToQueue} disabled={valid === 0} className={PRIMARY_BUTTON}>
            Add {valid} to queue
          </button>
        )}
      </div>

      {preview && (
        <div className="mt-3">
          <p className="text-sm text-gray-600 mb-2">
            {total} URL{total === 1 ? "" : "s"} found — {valid} valid, {duplicate} duplicate, {invalid} invalid,{" "}
            {unsupported} unsupported.
          </p>
          {total > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-md border border-gray-100 divide-y divide-gray-100">
              {preview.map((entry, i) => (
                <div key={i} className="px-3 py-1.5 text-xs flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 font-medium flex-shrink-0 ${STATUS_BADGE[entry.status]}`}>
                    {STATUS_LABEL[entry.status]}
                  </span>
                  <span className="truncate flex-1 text-gray-600" title={entry.raw}>
                    {entry.raw}
                  </span>
                  {entry.status !== "valid" && entry.reason && (
                    <span className="text-gray-400 flex-shrink-0">{entry.reason}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
