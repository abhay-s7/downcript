import { MetaSearchResultCard, parseSearchResults } from "@/app/lib/services/meta/parseSearchResults";

// Keeps IPC/raw-JSON details out of the UI layer -- components only ever
// see MetaSearchResultCard[], never the unparsed data-sjs/DOM-extracted
// nodes window.desktop hands back. Each function throws the same way its
// underlying IPC call does (no swallowed errors), so the caller's existing
// try/catch handles timeouts and "Unsupported Meta Ads Library URL" the
// same as any other failure.

// The first batch -- Meta's own server-rendered data-sjs payload, observed
// at roughly 10-30 results.
export async function searchCompetitorAds(url: string): Promise<MetaSearchResultCard[]> {
  if (!window.desktop) throw new Error("Competitor Ad Research needs the desktop app.");
  const raw = await window.desktop.searchMetaAds(url);
  return parseSearchResults(raw);
}

// Pagination beyond that first batch -- a kept-alive hidden window that
// scrolls Meta's real page and reads whatever new ad cards actually
// rendered (see the "Pagination beyond the first batch" comment in
// electron/main.js for how, and why this doesn't use data-sjs or a CDP
// debugger). start() only readies the session; it doesn't return ads --
// the already-displayed first batch came from searchCompetitorAds above.
export async function startCompetitorSearchSession(url: string): Promise<string> {
  if (!window.desktop) throw new Error("Competitor Ad Research needs the desktop app.");
  const { sessionId } = await window.desktop.searchMetaAdsSession.start(url);
  return sessionId;
}

// Each call is one bounded scroll-and-extract, not a loop -- an empty
// result means nothing new was found *this time*, not that no more ads
// exist. The caller decides how to present that (see
// CompetitorAdResearch.tsx).
export async function loadMoreCompetitorAds(sessionId: string): Promise<MetaSearchResultCard[]> {
  if (!window.desktop) throw new Error("Competitor Ad Research needs the desktop app.");
  const { ads } = await window.desktop.searchMetaAdsSession.more(sessionId);
  return parseSearchResults(ads);
}

export function stopCompetitorSearchSession(sessionId: string): void {
  void window.desktop?.searchMetaAdsSession.stop(sessionId);
}
