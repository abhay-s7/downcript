"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Section } from "@/app/lib/uiTypes";

const DESTINATIONS: Array<{ section: Section; label: string }> = [
  { section: "home", label: "Go to Home" },
  { section: "download", label: "Go to Download" },
  { section: "transcript", label: "Go to Transcript" },
  { section: "meta", label: "Go to Meta Ads" },
  { section: "library", label: "Go to Library" },
  { section: "settings", label: "Go to Settings" },
];

// Renders both the topline trigger button and the modal itself (kept as
// one component rather than splitting state across siblings) -- ⌘K/Ctrl+K
// opens it from anywhere, ⌘1-5/Ctrl+1-5 jump straight to a section without
// opening it at all, matching the reference's keyboard shortcuts.
export default function CommandPalette({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!open) setQuery("");
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      } else if (mod && /^[1-6]$/.test(e.key)) {
        e.preventDefault();
        const dest = DESTINATIONS[Number(e.key) - 1];
        if (dest) {
          onNavigate(dest.section);
          setOpen(false);
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onNavigate, open]);

  // Pure DOM side effect (focusing the input), not a setState call, so this
  // doesn't need the same restructuring as the query-reset above did.
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DESTINATIONS;
    return DESTINATIONS.filter((d) => d.label.toLowerCase().includes(q));
  }, [query]);

  function go(section: Section) {
    onNavigate(section);
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
        className="flex items-center gap-2.5 h-[38px] px-3 min-w-[300px] rounded-[11px] bg-surface border border-line text-text-3 text-[13px] transition-colors hover:border-line-2 hover:text-text-2"
      >
        <svg viewBox="0 0 16 16" className="w-[15px] h-[15px] stroke-current fill-none" strokeWidth={1.8} strokeLinecap="round">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" />
        </svg>
        Search or jump to…
        <span className="ml-auto font-mono text-[11px] text-text-3 border border-line-2 rounded-[6px] px-1.5 py-0.5">⌘K</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[16vh] bg-[rgba(20,24,40,.32)] backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-label="Command palette"
            className="w-[min(560px,92vw)] rounded-[18px] bg-white border border-line-2 shadow-[0_40px_80px_-20px_rgba(20,24,40,.35),0_0_60px_-20px_var(--color-accent-glow)] overflow-hidden"
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) go(results[0].section);
              }}
              placeholder="Type a command or search…"
              autoComplete="off"
              className="w-full h-14 px-5 bg-none border-0 border-b border-line text-text text-[15px] outline-none"
            />
            <ul className="list-none m-0 p-2">
              {results.map((d) => (
                <li
                  key={d.section}
                  onClick={() => go(d.section)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-text-2 cursor-pointer hover:bg-surface-3 hover:text-text"
                >
                  {d.label}
                </li>
              ))}
              {results.length === 0 && <li className="px-3 py-2.5 text-text-3">No matches</li>}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
