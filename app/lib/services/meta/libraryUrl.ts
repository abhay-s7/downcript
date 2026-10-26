export type MetaActiveStatus = "active" | "inactive" | "all";

// Meta's own "Sort by" control on the real Ads Library page (confirmed by
// opening it and reading the resulting URL, not guessed): selecting
// "Impressions: high to low" there produces
// sort_data[mode]=total_impressions, and "Most recent" produces
// sort_data[mode]=relevancy_monthly_grouped -- both with direction=desc.
// There's no exposed exact-impression-count field anywhere in this app's
// data sources, so "impressions" mode relies entirely on this native
// ordering rather than any client-side numeric sort.
export type MetaSortMode = "impressions" | "recent";

const SORT_MODE_PARAM: Record<MetaSortMode, string> = {
  impressions: "total_impressions",
  recent: "relevancy_monthly_grouped",
};

// Builds the real facebook.com/ads/library URL -- these are the web UI's own
// query params (what the page itself reads), not the separate Graph API's
// search_terms/ad_reached_countries shape used by meta:resolveAd's sibling,
// the official ads_archive endpoint.
//
// view_all_page_id is the same param Meta's own frontend uses for its "View
// all ads from this Page" link (what you land on after picking a Page from
// their own search typeahead) -- reusing it here, rather than inventing a
// new filtering mechanism, is what makes advertiser-specific search in this
// app behave like Meta's own tool. Takes precedence over a free-text query
// when both are present, matching that same page behavior.
export function buildLibraryUrl(opts: {
  query?: string;
  pageId?: string;
  country: string;
  activeStatus: MetaActiveStatus;
  sortMode?: MetaSortMode;
}): string {
  const { query, pageId, country, activeStatus, sortMode } = opts;
  const params = new URLSearchParams({
    active_status: activeStatus,
    ad_type: "all",
    country,
    media_type: "all",
  });
  if (pageId) {
    params.set("view_all_page_id", pageId);
  } else if (query && query.trim()) {
    params.set("q", query.trim());
  }
  if (sortMode) {
    params.set("sort_data[mode]", SORT_MODE_PARAM[sortMode]);
    params.set("sort_data[direction]", "desc");
  }
  return `https://www.facebook.com/ads/library/?${params.toString()}`;
}

// The documented single-ad deeplink format -- the same `?id=` shape Meta's
// own "View ad details" link uses and the one meta:resolveAd already parses
// (see parseSnapshot.ts's deeplink_ad_archive_result lookup), not a guess.
export function buildAdDetailUrl(adArchiveId: string): string {
  return `https://www.facebook.com/ads/library/?id=${encodeURIComponent(adArchiveId)}`;
}
