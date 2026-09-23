"use client";

import { ChevronLeft, ChevronRight, ChevronsRight, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

// Shared by CursorPagination's consumers: to keep the window below actually centered
// (rather than trailing behind, current pinned to the right edge) a cursor-paginated list
// needs to prefetch this many pages beyond the current one whenever more exist.
export const PAGINATION_WINDOW_SIZE = 5;
export const PAGINATION_WINDOW_HALF = Math.floor((PAGINATION_WINDOW_SIZE - 1) / 2);

// A sliding window of page numbers centered on `current` — no pinned "1" or "last page"
// anchors and no ellipsis. As `current` moves, the whole window moves with it, so pages
// that fall out of range simply drop off rather than collapsing into a "…".
//
// `upperBound` clamps the window's right edge. When `backfillFromUpperBound` is true (the
// true total is known) the window shifts left to stay full-width once it hits that edge —
// the standard "last few pages" look. When it's false (a cursor-paginated list where more
// pages may exist past `upperBound`, which is just how many have been fetched so far) the
// window is simply truncated on the right instead of backfilling — there's nothing to
// backfill from since those pages haven't been fetched yet. (CursorPagination's caller is
// expected to prefetch ahead — see PAGINATION_WINDOW_HALF — so this truncation is normally
// only visible for a frame while that prefetch is in flight.)
function buildPageWindow(current: number, upperBound: number, backfillFromUpperBound: boolean, windowSize = PAGINATION_WINDOW_SIZE): number[] {
  const half = Math.floor((windowSize - 1) / 2);
  let start = current - half;
  let end = start + windowSize - 1;

  if (start < 1) {
    start = 1;
    end = Math.min(windowSize, upperBound);
  }

  if (end > upperBound) {
    end = upperBound;
    start = backfillFromUpperBound ? Math.max(1, end - windowSize + 1) : Math.max(1, start);
  }

  return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);
}

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  labels: {
    previous: string;
    next: string;
    last: string;
  };
  className?: string;
}

const buttonBase =
  "inline-flex h-8 min-w-8 sm:h-9 sm:min-w-9 items-center justify-center gap-1.5 rounded-md border border-border px-2 sm:px-3 text-[12px] font-semibold text-foreground transition-colors hover:border-foreground/40 hover:bg-muted disabled:pointer-events-none disabled:opacity-40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

// Page-number buttons are round rather than the pill-shaped First/Prev/Next/Last controls,
// so the current page reads as a distinct "dot" in the sequence.
const numberButtonBase =
  "inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-border text-[12px] font-semibold text-foreground hover:border-foreground/40 hover:bg-muted disabled:pointer-events-none disabled:opacity-40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";
const numberButtonActive =
  "inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-foreground text-[12px] font-semibold text-background cursor-default";

export function Pagination({ page, totalPages, onPageChange, labels, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const range = buildPageWindow(page, totalPages, true);
  // Mobile shows a fixed 3-number window (not "whatever is within 1 of current"), so the row is
  // the same width on every page — otherwise page 1 (2 numbers) vs a middle page (3) re-centres it.
  const mobileRange = new Set(buildPageWindow(page, totalPages, true, 3));

  return (
    <nav aria-label="Pagination" className={`flex items-center gap-1 sm:gap-2 sm:flex-wrap ${className ?? ""}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
            className={buttonBase}
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="max-sm:sr-only">{labels.previous}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{labels.previous}</TooltipContent>
      </Tooltip>

      {range.map((item, slot) => (
        <button
          key={slot}
          type="button"
          aria-current={item === page ? "page" : undefined}
          onClick={() => onPageChange(item)}
          className={`${item === page ? numberButtonActive : numberButtonBase} mx-0.5${mobileRange.has(item) ? "" : " max-sm:hidden"}`}
        >
          {item}
        </button>
      ))}

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={page === totalPages}
            onClick={() => onPageChange(page + 1)}
            className={buttonBase}
          >
            <span className="max-sm:sr-only">{labels.next}</span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{labels.next}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={labels.last}
            disabled={page === totalPages}
            onClick={() => onPageChange(totalPages)}
            className={`${buttonBase} max-sm:hidden`}
          >
            <ChevronsRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{labels.last}</TooltipContent>
      </Tooltip>
    </nav>
  );
}

// Unlike buildPageWindow, this always reserves the full window width up front — including
// slots for pages not fetched yet — instead of starting narrow and growing once the
// background prefetch (see the caller) catches up. Growing later is what caused the visible
// "jump" as an extra button popped in and the centered row shifted horizontally; reserving
// the space from the first render means the only thing that changes later is a placeholder
// slot switching from disabled to clickable, which doesn't move anything.
function buildCursorWindow(current: number, pageCount: number, hasMore: boolean, windowSize = PAGINATION_WINDOW_SIZE): number[] {
  if (!hasMore) return buildPageWindow(current, pageCount, true, windowSize);
  const half = Math.floor((windowSize - 1) / 2);
  const start = Math.max(current - half, 1);
  return Array.from({ length: windowSize }, (_, i) => start + i);
}

interface CursorPaginationProps {
  /** 0-indexed position within the pages fetched so far. */
  pageIndex: number;
  /** How many pages have been fetched so far (not the true total — that's unknown upfront). */
  pageCount: number;
  /** Whether a page beyond `pageCount` might still exist upstream. */
  hasMore: boolean;
  isFetchingNext: boolean;
  onGoToPage: (pageIndex: number) => void;
  onNext: () => void;
  labels: {
    previous: string;
    next: string;
  };
  className?: string;
}

// For cursor-paginated lists (e.g. the Library's live UK/PH browse, which pages via an
// upstream cursor rather than an offset+total) the true page count isn't known until the
// last page has actually been fetched. This renders numbered buttons only for pages already
// in hand — no "Last" button, since there's nothing to jump to yet.
export function CursorPagination({
  pageIndex,
  pageCount,
  hasMore,
  isFetchingNext,
  onGoToPage,
  onNext,
  labels,
  className,
}: CursorPaginationProps) {
  if (pageCount <= 1 && !hasMore && pageIndex === 0) return null;

  const range = buildCursorWindow(pageIndex + 1, pageCount, hasMore);
  const mobileRange = new Set(buildCursorWindow(pageIndex + 1, pageCount, hasMore, 3));

  return (
    <nav aria-label="Pagination" className={`flex items-center gap-1 sm:gap-2 sm:flex-wrap ${className ?? ""}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={pageIndex === 0}
            onClick={() => onGoToPage(pageIndex - 1)}
            className={buttonBase}
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="max-sm:sr-only">{labels.previous}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{labels.previous}</TooltipContent>
      </Tooltip>

      {range.map((item, slot) => (
        <button
          key={slot}
          type="button"
          aria-current={item === pageIndex + 1 ? "page" : undefined}
          disabled={item > pageCount}
          onClick={() => onGoToPage(item - 1)}
          className={`${item === pageIndex + 1 ? numberButtonActive : numberButtonBase} mx-0.5${mobileRange.has(item) ? "" : " max-sm:hidden"}`}
        >
          {item}
        </button>
      ))}

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={(!hasMore && pageIndex + 1 >= pageCount) || isFetchingNext}
            onClick={onNext}
            className={buttonBase}
          >
            {isFetchingNext ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <span className="max-sm:sr-only">{labels.next}</span>
            )}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{labels.next}</TooltipContent>
      </Tooltip>
    </nav>
  );
}
