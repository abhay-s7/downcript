"use client";

import { useEffect, useState } from "react";
import { CARD, BTN_GHOST, CHIP, CHIP_TRANSCRIPT, LINK } from "@/app/lib/uiStyles";
import { MetaSearchResultCard } from "@/app/lib/services/meta/parseSearchResults";
import { buildAdDetailUrl } from "@/app/lib/services/meta/libraryUrl";

export default function CompetitorAdDetailModal({
  card,
  bookmarked,
  onToggleBookmark,
  onClose,
}: {
  card: MetaSearchResultCard;
  bookmarked: boolean;
  onToggleBookmark: (card: MetaSearchResultCard) => void;
  onClose: () => void;
}) {
  const [copyLabel, setCopyLabel] = useState("Copy Link");
  const detailUrl = buildAdDetailUrl(card.adArchiveId);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(detailUrl);
      setCopyLabel("Copied!");
    } catch {
      setCopyLabel("Couldn't copy");
    }
    setTimeout(() => setCopyLabel("Copy Link"), 1500);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,24,40,.45)] backdrop-blur-sm p-6"
      onClick={onClose}
    >
      <div className={`${CARD} w-full max-w-3xl max-h-[85vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-line">
          <div className="flex items-center gap-2.5 min-w-0">
            {card.pageProfilePictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- direct Meta CDN URL
              <img
                src={card.pageProfilePictureUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full bg-surface-3 object-cover flex-shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-surface-3 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text truncate">{card.pageName || "Unknown advertiser"}</div>
              {card.startDateLabel && <div className="text-xs text-text-3">Started {card.startDateLabel}</div>}
            </div>
          </div>
          <button onClick={onClose} className={LINK}>
            Close
          </button>
        </div>

        <div className="p-4 bg-surface-3 flex items-center justify-center" style={{ minHeight: 320 }}>
          {card.creativeKind === "video" && card.videoUrl ? (
            <video src={card.videoUrl} poster={card.thumbnailUrl} controls autoPlay className="max-h-[55vh] max-w-full" />
          ) : card.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- direct Meta CDN URL
            <img
              src={card.thumbnailUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="max-h-[55vh] max-w-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span className="text-sm text-text-3">No creative available</span>
          )}
        </div>

        <div className="p-4 flex flex-col gap-3">
          {(card.isActive !== undefined || card.platforms) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {card.isActive !== undefined && (
                <span className={card.isActive ? CHIP_TRANSCRIPT : CHIP}>{card.isActive ? "Active" : "Inactive"}</span>
              )}
              {card.platforms?.map((p) => (
                <span key={p} className={CHIP}>
                  {p}
                </span>
              ))}
            </div>
          )}

          {card.headline && <p className="text-sm font-medium text-text">{card.headline}</p>}
          {card.bodyText && <p className="text-sm text-text-2 whitespace-pre-wrap">{card.bodyText}</p>}
          {!card.headline && !card.bodyText && <p className="text-sm text-text-3">No ad copy available.</p>}

          <div className="flex items-center gap-3 pt-2 border-t border-line">
            <button onClick={() => onToggleBookmark(card)} className={BTN_GHOST}>
              {bookmarked ? "★ Saved" : "☆ Bookmark"}
            </button>
            <button onClick={handleCopyLink} className={BTN_GHOST}>
              {copyLabel}
            </button>
            <a href={detailUrl} target="_blank" rel="noopener noreferrer" className={`${LINK} ml-auto`}>
              Open on Meta Ad Library
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
