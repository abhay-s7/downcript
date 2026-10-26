"use client";

import { useEffect, useRef, useState } from "react";
import { CARD, SELECT_SM, BTN_PRIMARY, BTN_GHOST, LINK_MUTED, LINK } from "@/app/lib/uiStyles";
import { buildAdDetailUrl, buildLibraryUrl, MetaActiveStatus, MetaSortMode } from "@/app/lib/services/meta/libraryUrl";
import { AdvertiserSuggestion, MetaSearchResultCard } from "@/app/lib/services/meta/parseSearchResults";
import {
  loadMoreCompetitorAds,
  searchCompetitorAds,
  startCompetitorSearchSession,
  stopCompetitorSearchSession,
} from "@/app/lib/services/meta/competitorSearch";
import { BookmarkedAd } from "@/app/desktop";
import AdvertiserSearchInput from "@/app/components/AdvertiserSearchInput";
import CompetitorAdCard from "@/app/components/CompetitorAdCard";
import CompetitorAdDetailModal from "@/app/components/CompetitorAdDetailModal";

// "ALL" is Meta's own country param value for "All Countries" -- a
// reasonable starting set, not an exhaustive list of what Meta's country
// selector supports.
const ALL_COUNTRIES_CODE = "ALL";
const COUNTRIES = [
  { code: ALL_COUNTRIES_CODE, label: "All Countries" },
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "IN", label: "India" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "BR", label: "Brazil" },
];

type SearchStatus = "idle" | "loading" | "loaded" | "error";
type ViewMode = "results" | "bookmarks";

// After this many consecutive "more" calls in a row find zero new ads, the
// button is disabled rather than left clickable forever -- a real end-of-
// results signal doesn't exist (Meta exposes no total), so this is a
// practical stopping point, not a claim that no further ads could ever
// exist.
const MAX_CONSECUTIVE_EMPTY_LOADS = 3;

// A Facebook Page id is always purely numeric -- typing one into the single
// search box (rather than requiring a separate field) still lets the exact-
// advertiser search the brief asks for take priority over a keyword search,
// the same way Meta's own "View all ads from this Page" link does.
function isPageId(value: string): boolean {
  return /^\d+$/.test(value);
}

// "Impressions: high to low" has no exact numbers available from any data
// source this app has (see libraryUrl.ts) -- it's entirely Meta's own
// native fetch-time ordering, never reordered client-side. "Most recent"
// DOES have a real, parseable per-ad date (startDateMs), so it's
// additionally re-applied client-side after every fetch/merge, which is
// what guarantees correctness even if Meta's own "relevancy_monthly_grouped"
// mode isn't a strict date sort under the hood. Ads with no parseable date
// sink to the end rather than being treated as oldest or newest.
function sortForDisplay(cards: MetaSearchResultCard[], mode: MetaSortMode): MetaSearchResultCard[] {
  if (mode !== "recent") return cards;
  return [...cards].sort((a, b) => {
    if (a.startDateMs === undefined && b.startDateMs === undefined) return 0;
    if (a.startDateMs === undefined) return 1;
    if (b.startDateMs === undefined) return -1;
    return b.startDateMs - a.startDateMs;
  });
}

export default function CompetitorAdResearch() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDesktop] = useState(() => typeof window !== "undefined" && !!window.desktop);

  const [query, setQuery] = useState("");
  const [selectedAdvertiser, setSelectedAdvertiser] = useState<AdvertiserSuggestion | null>(null);
  const [country, setCountry] = useState("US");
  const [activeStatus, setActiveStatus] = useState<MetaActiveStatus>("active");
  const [sortMode, setSortMode] = useState<MetaSortMode>("impressions");

  const [status, setStatus] = useState<SearchStatus>("idle");
  const [error, setError] = useState("");
  const [results, setResults] = useState<MetaSearchResultCard[]>([]);
  const [lastSearchUrl, setLastSearchUrl] = useState<string | null>(null);

  // Pagination beyond the first batch -- see competitorSearch.ts. Lazily
  // upgraded to a kept-alive session only once "Load More" is actually
  // clicked, so a plain search that never needs more results never pays for
  // the extra hidden window.
  const sessionIdRef = useRef<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState("");
  const [consecutiveEmptyLoads, setConsecutiveEmptyLoads] = useState(0);

  const [viewMode, setViewMode] = useState<ViewMode>("results");
  const [detailCard, setDetailCard] = useState<MetaSearchResultCard | null>(null);

  const [bookmarks, setBookmarks] = useState<BookmarkedAd[]>([]);
  useEffect(() => {
    if (!window.desktop) return;
    window.desktop.bookmarks.list().then(setBookmarks);
    return window.desktop.bookmarks.onChanged(setBookmarks);
  }, []);

  // Releases whatever pagination session is open -- on a fresh search (its
  // results are stale against a new query/filter) and on unmount (an
  // abandoned hidden window would otherwise leak for the rest of the app's
  // life).
  useEffect(() => {
    return () => {
      if (sessionIdRef.current) stopCompetitorSearchSession(sessionIdRef.current);
    };
  }, []);

  function isBookmarked(adArchiveId: string): boolean {
    return bookmarks.some((b) => b.adArchiveId === adArchiveId);
  }

  function handleToggleBookmark(card: MetaSearchResultCard) {
    if (!window.desktop) return;
    void window.desktop.bookmarks.toggle({
      ...card,
      adArchiveId: card.adArchiveId,
      url: buildAdDetailUrl(card.adArchiveId),
    });
  }

  // A selected advertiser only drives a Page-specific search while the
  // input still holds exactly their name -- if the user kept typing after
  // selecting one, it no longer unambiguously refers to that Page, so this
  // falls back to the ordinary keyword/Page-id handling below instead of
  // silently searching the stale selection.
  // sortOverride lets handleSortModeChange force a fresh search with the
  // just-selected mode immediately, instead of reading sortMode from state
  // (which wouldn't reflect the change until the next render).
  function buildSearchUrl(sortOverride?: MetaSortMode): string {
    const trimmed = query.trim();
    const mode = sortOverride ?? sortMode;
    if (selectedAdvertiser && selectedAdvertiser.pageName === trimmed) {
      return buildLibraryUrl({
        pageId: selectedAdvertiser.pageId,
        query: selectedAdvertiser.pageId ? undefined : selectedAdvertiser.pageName,
        country,
        activeStatus,
        sortMode: mode,
      });
    }
    return buildLibraryUrl({
      pageId: isPageId(trimmed) ? trimmed : undefined,
      query: isPageId(trimmed) ? undefined : trimmed || undefined,
      country,
      activeStatus,
      sortMode: mode,
    });
  }

  // Changing sort mode mid-session can't just reorder what's already
  // loaded: "Impressions: high to low" has no numbers to sort by client-
  // side at all, so the only honest way to reflect it is a fresh fetch in
  // that native order -- applied uniformly (not only for that mode) so
  // switching never leaves a stale, mislabeled order on screen.
  function handleSortModeChange(mode: MetaSortMode) {
    setSortMode(mode);
    if (lastSearchUrl) void handleSearch(mode);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (selectedAdvertiser && value.trim() !== selectedAdvertiser.pageName) {
      setSelectedAdvertiser(null);
    }
  }

  async function handleSearch(sortOverride?: MetaSortMode) {
    if (!window.desktop) return;
    if (sessionIdRef.current) {
      stopCompetitorSearchSession(sessionIdRef.current);
      sessionIdRef.current = null;
    }
    setConsecutiveEmptyLoads(0);
    setLoadMoreError("");
    setViewMode("results");
    const url = buildSearchUrl(sortOverride);
    setLastSearchUrl(url);
    setStatus("loading");
    setError("");
    try {
      const ads = await searchCompetitorAds(url);
      setResults(sortForDisplay(ads, sortOverride ?? sortMode));
      setStatus("loaded");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
      setStatus("error");
    }
  }

  async function handleLoadMore() {
    if (!lastSearchUrl || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError("");
    try {
      if (!sessionIdRef.current) {
        sessionIdRef.current = await startCompetitorSearchSession(lastSearchUrl);
      }
      const newAds = await loadMoreCompetitorAds(sessionIdRef.current);
      const existingIds = new Set(results.map((r) => r.adArchiveId));
      const toAdd = newAds.filter((a) => !existingIds.has(a.adArchiveId));
      if (toAdd.length > 0) setResults((prev) => sortForDisplay([...prev, ...toAdd], sortMode));
      setConsecutiveEmptyLoads((n) => (toAdd.length === 0 ? n + 1 : 0));
    } catch (err) {
      setLoadMoreError(err instanceof Error ? err.message : "Couldn't load more ads.");
    } finally {
      setLoadingMore(false);
    }
  }

  function handleClear() {
    if (sessionIdRef.current) {
      stopCompetitorSearchSession(sessionIdRef.current);
      sessionIdRef.current = null;
    }
    setQuery("");
    setSelectedAdvertiser(null);
    setResults([]);
    setLastSearchUrl(null);
    setStatus("idle");
    setError("");
    setConsecutiveEmptyLoads(0);
    setLoadMoreError("");
  }

  const activeList = viewMode === "bookmarks" ? bookmarks : results;

  if (!isDesktop) {
    return (
      <div className={`${CARD} p-6`}>
        <h3 className="text-sm font-semibold text-text mb-1">Competitor Ad Research</h3>
        <p className="text-sm text-text-2">Browsing the Meta Ads Library needs the desktop app.</p>
      </div>
    );
  }

  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text">Competitor Ad Research</h3>
          {!isExpanded && (
            <p className="text-xs text-text-2 mt-0.5 truncate">
              Search real Meta Ads Library ads for competitor brands, Page IDs, or keywords.
            </p>
          )}
        </div>
        <button onClick={() => setIsExpanded((v) => !v)} className={`${LINK} flex-shrink-0`}>
          {isExpanded ? "Collapse" : "Expand"}
        </button>
      </div>

      <div className={isExpanded ? "mt-3.5" : "hidden"}>
        <div className="flex flex-wrap items-stretch gap-2.5 mb-3">
          <AdvertiserSearchInput
            query={query}
            onQueryChange={handleQueryChange}
            selectedAdvertiser={selectedAdvertiser}
            onSelectAdvertiser={setSelectedAdvertiser}
            onSubmit={handleSearch}
            country={country}
            activeStatus={activeStatus}
            className="flex-1 min-w-[220px]"
          />
          <select value={country} onChange={(e) => setCountry(e.target.value)} className={`${SELECT_SM} min-w-[150px] flex-shrink-0`}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={activeStatus}
            onChange={(e) => setActiveStatus(e.target.value as MetaActiveStatus)}
            className={`${SELECT_SM} min-w-[120px] flex-shrink-0`}
          >
            <option value="active">Active ads</option>
            <option value="inactive">Inactive ads</option>
            <option value="all">All ads</option>
          </select>
          <select
            value={sortMode}
            onChange={(e) => handleSortModeChange(e.target.value as MetaSortMode)}
            className={`${SELECT_SM} min-w-[150px] flex-shrink-0`}
            aria-label="Sort by"
          >
            <option value="impressions">Impressions: high to low</option>
            <option value="recent">Most recent</option>
          </select>
          <button onClick={() => handleSearch()} className={`${BTN_PRIMARY} h-9 px-4 flex-shrink-0`}>
            Search
          </button>
        </div>

        <div className="flex items-center gap-4 mb-3">
          {lastSearchUrl && (
            <button onClick={handleClear} className={LINK_MUTED}>
              Clear
            </button>
          )}
          <button
            onClick={() => setViewMode((v) => (v === "bookmarks" ? "results" : "bookmarks"))}
            className={LINK_MUTED}
          >
            {viewMode === "bookmarks" ? "Back to Results" : `Show Bookmarked Ads (${bookmarks.length})`}
          </button>
        </div>

        {viewMode === "results" && status === "loading" && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center text-text-3">
              <div className="w-8 h-8 mx-auto mb-3 rounded-full border-2 border-line-2 border-t-accent animate-spin" />
              Searching the Meta Ads Library…
            </div>
          </div>
        )}

        {viewMode === "results" && status === "error" && (
          <div className="flex flex-col items-center justify-center text-center px-6 py-16 gap-3">
            <p className="text-sm text-danger max-w-[420px]">{error}</p>
            <button onClick={() => handleSearch()} className={BTN_PRIMARY}>
              Retry
            </button>
          </div>
        )}

        {viewMode === "results" && status === "idle" && (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-text-3">Search for a brand, Page ID, or keyword to see real competitor ads here.</p>
          </div>
        )}

        {viewMode === "results" && status === "loaded" && results.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-text-3">No ads found for this search.</p>
          </div>
        )}

        {viewMode === "bookmarks" && bookmarks.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-text-3">No bookmarked ads yet -- click ☆ Bookmark on any ad.</p>
          </div>
        )}

        {activeList.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {activeList.map((card) => (
                <CompetitorAdCard
                  key={card.adArchiveId}
                  card={card}
                  bookmarked={isBookmarked(card.adArchiveId)}
                  onToggleBookmark={handleToggleBookmark}
                  onOpenDetail={setDetailCard}
                />
              ))}
            </div>

            {viewMode === "results" && (
              <div className="flex flex-col items-center gap-2 mt-5 text-center">
                {/* The actual count loaded so far -- Meta exposes no total
                    for this app to report, so this never claims to know how
                    many ads exist in total, only how many have actually
                    been retrieved. */}
                <p className="text-xs text-text-3">
                  {results.length} ad{results.length === 1 ? "" : "s"} loaded
                  {consecutiveEmptyLoads >= MAX_CONSECUTIVE_EMPTY_LOADS
                    ? " -- no further new ads found after several attempts."
                    : "."}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore || consecutiveEmptyLoads >= MAX_CONSECUTIVE_EMPTY_LOADS}
                    className={BTN_GHOST}
                  >
                    {loadingMore ? "Loading more…" : "Load More Ads"}
                  </button>
                  {lastSearchUrl && (
                    <a href={lastSearchUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
                      View all on Meta Ad Library
                    </a>
                  )}
                </div>
                {loadMoreError && <p className="text-xs text-danger">{loadMoreError}</p>}
              </div>
            )}
          </>
        )}
      </div>

      {detailCard && (
        <CompetitorAdDetailModal
          card={detailCard}
          bookmarked={isBookmarked(detailCard.adArchiveId)}
          onToggleBookmark={handleToggleBookmark}
          onClose={() => setDetailCard(null)}
        />
      )}
    </div>
  );
}
