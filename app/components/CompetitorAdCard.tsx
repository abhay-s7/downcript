"use client";

import { useState } from "react";
import { CARD, CHIP, CHIP_TRANSCRIPT, LINK_MUTED } from "@/app/lib/uiStyles";
import { MetaSearchResultCard } from "@/app/lib/services/meta/parseSearchResults";
import { buildAdDetailUrl } from "@/app/lib/services/meta/libraryUrl";

// Object-contain (never object-cover) for the creative itself -- the brief
// is explicit that portrait/square/landscape creatives must not be cropped,
// so this letterboxes/pillarboxes on a neutral background instead of
// filling the box by cutting off content.
export default function CompetitorAdCard({
  card,
  bookmarked,
  onToggleBookmark,
  onOpenDetail,
}: {
  card: MetaSearchResultCard;
  bookmarked: boolean;
  onToggleBookmark: (card: MetaSearchResultCard) => void;
  onOpenDetail: (card: MetaSearchResultCard) => void;
}) {
  const [copyLabel, setCopyLabel] = useState("Copy Link");
  const detailUrl = buildAdDetailUrl(card.adArchiveId);

  async function handleCopyLink(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(detailUrl);
      setCopyLabel("Copied!");
    } catch {
      setCopyLabel("Couldn't copy");
    }
    setTimeout(() => setCopyLabel("Copy Link"), 1500);
  }

  function handleBookmarkClick(e: React.MouseEvent) {
    e.stopPropagation();
    onToggleBookmark(card);
  }

  return (
    <div
      className={`${CARD} overflow-hidden cursor-pointer flex flex-col`}
      onClick={() => onOpenDetail(card)}
    >
      <div className="h-48 bg-surface-3 relative flex items-center justify-center overflow-hidden">
        {card.creativeKind === "video" && card.videoUrl ? (
          <video
            src={card.videoUrl}
            poster={card.thumbnailUrl}
            controls
            className="max-h-full max-w-full"
            onClick={(e) => e.stopPropagation()}
          />
        ) : card.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- direct Meta CDN URL
          <img
            src={card.thumbnailUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="max-h-full max-w-full object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <span className="text-xs text-text-3 px-4 text-center">No creative available</span>
        )}
        {card.isActive !== undefined && (
          <span className={`absolute top-2 left-2 ${card.isActive ? CHIP_TRANSCRIPT : CHIP}`}>
            {card.isActive ? "Active" : "Inactive"}
          </span>
        )}
      </div>

      <div className="p-3.5 flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          {card.pageProfilePictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- direct Meta CDN URL
            <img
              src={card.pageProfilePictureUrl}
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
          <span className="text-sm font-medium text-text truncate">{card.pageName || "Unknown advertiser"}</span>
        </div>

        {(card.headline || card.bodyText) && (
          <p className="text-[13px] text-text-2 line-clamp-2">{card.headline || card.bodyText}</p>
        )}

        {(card.startDateLabel || card.platforms) && (
          <div className="flex items-center gap-1.5 flex-wrap mt-auto pt-1">
            {card.startDateLabel && <span className={CHIP}>{card.startDateLabel}</span>}
            {card.platforms?.slice(0, 2).map((p) => (
              <span key={p} className={CHIP}>
                {p}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1.5 border-t border-line mt-1">
          <button onClick={handleBookmarkClick} className={LINK_MUTED}>
            {bookmarked ? "★ Saved" : "☆ Bookmark"}
          </button>
          <button onClick={handleCopyLink} className={LINK_MUTED}>
            {copyLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
