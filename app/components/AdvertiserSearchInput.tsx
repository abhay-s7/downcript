"use client";

import { useEffect, useRef, useState } from "react";
import { INPUT } from "@/app/lib/uiStyles";
import { MetaActiveStatus, buildLibraryUrl } from "@/app/lib/services/meta/libraryUrl";
import { AdvertiserSuggestion, extractAdvertiserSuggestions } from "@/app/lib/services/meta/parseSearchResults";
import { searchCompetitorAds } from "@/app/lib/services/meta/competitorSearch";

const COMPACT_INPUT = INPUT.replace("h-12", "h-9");
const SUGGEST_MIN_CHARS = 2;
const SUGGEST_DEBOUNCE_MS = 300;
const SUGGEST_LIMIT = 8;

// Highlights the substring of `name` that matches `query` (case-insensitive,
// first occurrence only) -- a plain split/slice rather than a regex escape
// dance, since the match is always a literal substring of typed text.
function HighlightedName({ name, query }: { name: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{name}</>;
  const idx = name.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{name}</>;
  return (
    <>
      {name.slice(0, idx)}
      <mark className="bg-accent-soft text-text rounded-[2px]">{name.slice(idx, idx + q.length)}</mark>
      {name.slice(idx + q.length)}
    </>
  );
}

// Wraps the existing Competitor Ad Research search input with a real-time
// advertiser-suggestions dropdown -- derived entirely from the same
// meta:searchAds data the search itself already uses (a keyword search's
// own results, grouped by distinct page), not a separate typeahead
// endpoint or any fabricated data.
export default function AdvertiserSearchInput({
  query,
  onQueryChange,
  selectedAdvertiser,
  onSelectAdvertiser,
  onSubmit,
  country,
  activeStatus,
  className,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  selectedAdvertiser: AdvertiserSuggestion | null;
  onSelectAdvertiser: (advertiser: AdvertiserSuggestion) => void;
  onSubmit: () => void;
  country: string;
  activeStatus: MetaActiveStatus;
  className?: string;
}) {
  const [suggestions, setSuggestions] = useState<AdvertiserSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Discards a response that's no longer for the latest keystroke -- a slow
  // request for an earlier query resolving after a newer one started would
  // otherwise overwrite fresher (or empty) suggestions with stale ones.
  const requestGenerationRef = useRef(0);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();

    // Nothing to reset here -- showDropdown (render-time) already hides the
    // dropdown below this length regardless of whatever stale suggestions/
    // loading state is still sitting in memory from a longer query.
    if (trimmed.length < SUGGEST_MIN_CHARS) return;

    const generation = ++requestGenerationRef.current;

    debounceRef.current = setTimeout(async () => {
      if (!window.desktop) return;
      setLoading(true);
      setErrored(false);
      setOpen(true);
      try {
        const url = buildLibraryUrl({ query: trimmed, country, activeStatus });
        const cards = await searchCompetitorAds(url);
        if (requestGenerationRef.current !== generation) return; // a newer query has since started
        setSuggestions(extractAdvertiserSuggestions(cards, SUGGEST_LIMIT));
        setLoading(false);
        setHighlightedIndex(-1);
      } catch {
        if (requestGenerationRef.current !== generation) return;
        // Suggestions are a convenience, not a requirement -- a failed fetch
        // just means no dropdown, never blocks the user from searching
        // normally with whatever they already typed.
        setSuggestions([]);
        setLoading(false);
        setErrored(true);
      }
    }, SUGGEST_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, country, activeStatus]);

  function handleSelect(advertiser: AdvertiserSuggestion) {
    onSelectAdvertiser(advertiser);
    onQueryChange(advertiser.pageName);
    setOpen(false);
    setSuggestions([]);
  }

  function handleChange(value: string) {
    onQueryChange(value);
    // Editing away from a selected advertiser's exact name means it no
    // longer unambiguously refers to that Page -- the parent clears its own
    // selectedAdvertiser state when the text it's holding stops matching
    // (see CompetitorAdResearch.tsx's buildSearchUrl), this just makes sure
    // a fresh suggestion fetch starts right away rather than waiting on it.
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter") onSubmit();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        handleSelect(suggestions[highlightedIndex]);
      } else {
        setOpen(false);
        onSubmit();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && query.trim().length >= SUGGEST_MIN_CHARS;

  return (
    <div ref={wrapperRef} className={`relative ${className || ""}`}>
      <input
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => query.trim().length >= SUGGEST_MIN_CHARS && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Advertiser name, Page ID, or keyword…"
        className={`${COMPACT_INPUT} w-full`}
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls="advertiser-suggestions-listbox"
        aria-autocomplete="list"
      />
      {selectedAdvertiser && selectedAdvertiser.pageName === query.trim() && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-accent pointer-events-none">
          Page selected
        </span>
      )}

      {showDropdown && (
        <div
          id="advertiser-suggestions-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-line-2 rounded-[10px] shadow-[0_18px_36px_-12px_rgba(20,24,40,.25)] z-20 overflow-hidden max-h-72 overflow-y-auto"
        >
          {loading && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-text-3">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-line-2 border-t-accent animate-spin" />
              Searching advertisers…
            </div>
          )}
          {!loading && errored && (
            <div className="px-3.5 py-2.5 text-sm text-text-3">
              Couldn&apos;t load suggestions -- you can still search &quot;{query.trim()}&quot; directly.
            </div>
          )}
          {!loading && !errored && suggestions.length === 0 && (
            <div className="px-3.5 py-2.5 text-sm text-text-3">No matching advertisers found.</div>
          )}
          {!loading &&
            !errored &&
            suggestions.map((s, i) => (
              <button
                key={s.pageId || s.pageName}
                type="button"
                role="option"
                aria-selected={i === highlightedIndex}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(s)}
                onMouseEnter={() => setHighlightedIndex(i)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left transition-colors ${
                  i === highlightedIndex ? "bg-surface-3" : ""
                }`}
              >
                {s.pageProfilePictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- direct Meta CDN URL
                  <img
                    src={s.pageProfilePictureUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 rounded-full flex-shrink-0 bg-surface-3 object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full flex-shrink-0 bg-surface-3" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-text truncate">
                    <HighlightedName name={s.pageName} query={query} />
                  </span>
                  <span className="block text-[11px] text-text-3 truncate">
                    {s.pageId ? `Page ID ${s.pageId}` : `${s.matchingAdCount} matching ad${s.matchingAdCount === 1 ? "" : "s"}`}
                  </span>
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
