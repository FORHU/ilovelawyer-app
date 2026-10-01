"use client";
import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  FloatingPortal,
  autoUpdate,
  flip,
  hide,
  inline,
  offset,
  safePolygon,
  shift,
  useDelayGroup,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { Sheet, SheetContent, SheetTitle } from "@workspace/ui/components/sheet";
import { parseLibraryHref } from "@/lib/law/internal-library-link";
import { lawPreviewQueryOptions } from "@/lib/law/queries";
import type { CitationRankItem, CitationRankTier } from "@/lib/chat/mutations";
import { CitationCta, CitationPreviewBody, CitationPreviewCard, CitationRankNote } from "./citation-preview-card";

// Yellow tint + solid gold underline. Deliberately distinct from the two other inline treatments
// in a reply (assistant-message.tsx): the active evidence quote is a stronger yellow-200 <mark>
// with no underline, and a decision anchor is a dotted gold underline with no fill. The two can't
// nest — quote matching only runs on plain-string children, and a citation is an <a>.
// box-decoration-clone repeats the padding/rounding on every line of a citation that wraps; the
// -mx-0.5 cancels the px-0.5 so the tint doesn't shift the surrounding text.
const CITATION_BASE_CLASS =
  "-mx-0.5 box-decoration-clone cursor-pointer rounded-[3px] px-0.5 font-medium text-foreground " +
  "underline underline-offset-[3px] transition-colors duration-150 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold";

const CITATION_NEUTRAL_CLASS =
  "bg-yellow-100 decoration-brand-gold decoration-[1.5px] " +
  "hover:bg-yellow-200 data-[open]:bg-yellow-200 " +
  "dark:bg-yellow-400/15 dark:hover:bg-yellow-400/25 dark:data-[open]:bg-yellow-400/25";

// A rated citation changes fill AND underline style, so the tier never rides on colour alone:
// High is a solid green underline, Medium dashed blue, Low dotted slate. Unrated (no entry in
// the message's citationRanking) keeps the neutral treatment above.
const CITATION_TIER_CLASS: Record<CitationRankTier, string> = {
  HIGH:
    "bg-emerald-100 decoration-emerald-600 decoration-solid decoration-2 hover:bg-emerald-200 data-[open]:bg-emerald-200 " +
    "dark:bg-emerald-400/15 dark:decoration-emerald-400 dark:hover:bg-emerald-400/25 dark:data-[open]:bg-emerald-400/25",
  MEDIUM:
    "bg-sky-100 decoration-sky-600 decoration-dashed decoration-[1.5px] hover:bg-sky-200 data-[open]:bg-sky-200 " +
    "dark:bg-sky-400/15 dark:decoration-sky-400 dark:hover:bg-sky-400/25 dark:data-[open]:bg-sky-400/25",
  LOW:
    "bg-slate-100 decoration-slate-500 decoration-dotted decoration-[1.5px] hover:bg-slate-200 data-[open]:bg-slate-200 " +
    "dark:bg-slate-400/15 dark:decoration-slate-400 dark:hover:bg-slate-400/25 dark:data-[open]:bg-slate-400/25",
};

// A click is a PointerEvent carrying the real input type in Chromium and Firefox; where it isn't
// (older iOS Safari), fall back to "this device can't hover", which is what matters here anyway —
// a device without hover never sees the preview card.
function isTouchClick(e: React.MouseEvent): boolean {
  const pointerType = (e.nativeEvent as Partial<PointerEvent>).pointerType;
  if (pointerType) return pointerType === "touch";
  return window.matchMedia("(hover: none)").matches;
}

/**
 * An inline chat citation that resolved to a Library document. It's a real
 * `<a target="_blank">` — click, Enter, middle-click and "copy link" all behave natively, and
 * open the Library without leaving the conversation. On top of that:
 *
 * - mouse: hovering opens a preview card after the FloatingDelayGroup's open delay (the preview
 *   is prefetched on pointerenter, during that delay); safePolygon keeps it open while the
 *   pointer crosses to the card's CTA, and inline() anchors it to the hovered line of a citation
 *   that wraps.
 * - keyboard: focus-visible opens the same card (exposed via aria-describedby), Esc closes it.
 * - touch: a tap opens the preview in a bottom sheet instead of navigating — the sheet's CTA
 *   navigates. Hover cards don't exist on touch, and navigating on the first tap would give
 *   touch users no preview at all.
 *
 * Must render inside a FloatingDelayGroup (AssistantMessage provides one per bubble) — that's
 * where the hover delay comes from, and what lets the card move between adjacent citations
 * without re-waiting.
 */
export function CitationLink({ href, children, rank }: { href: string; children: React.ReactNode; rank?: CitationRankItem }) {
  const { t } = useTranslation("library");
  const queryClient = useQueryClient();
  const target = React.useMemo(() => parseLibraryHref(href), [href]);
  const [open, setOpen] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const {
    refs: { setReference, setFloating },
    floatingStyles,
    context,
    middlewareData,
  } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "top",
    whileElementsMounted: autoUpdate,
    middleware: [inline(), offset(8), flip({ padding: 12 }), shift({ padding: 12 }), hide()],
  });
  const { delay } = useDelayGroup(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context, { delay, mouseOnly: true, handleClose: safePolygon() }),
    useFocus(context, { visibleOnly: true }),
    useDismiss(context),
    // The card only describes the link (which already goes to the same place), so it's exposed
    // as the link's description rather than as a separate dialog to navigate into.
    useRole(context, { role: "tooltip" }),
  ]);

  const prefetch = () => {
    if (target) void queryClient.prefetchQuery(lawPreviewQueryOptions(target.category, target.id));
  };

  return (
    <>
      <a
        ref={setReference}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-open={open || sheetOpen ? "" : undefined}
        data-rank={rank?.tier}
        className={`${CITATION_BASE_CLASS} ${rank ? CITATION_TIER_CLASS[rank.tier] : CITATION_NEUTRAL_CLASS}`}
        {...getReferenceProps({
          onPointerEnter: prefetch,
          onFocus: prefetch,
          onClick: (e: React.MouseEvent) => {
            if (!isTouchClick(e) || !target) return;
            e.preventDefault();
            prefetch();
            setSheetOpen(true);
          },
        })}
      >
        {children}
        {rank && (
          <span className="sr-only">
            {" ("}
            {t("citationRank.srPrefix")}
            {t(`citationRank.${rank.tier.toLowerCase()}`)}
            {")"}
          </span>
        )}
        <span className="sr-only">{t("citationPreview.opensInNewTab")}</span>
      </a>

      {open && target && (
        <FloatingPortal>
          <div
            ref={setFloating}
            style={{ ...floatingStyles, visibility: middlewareData.hide?.referenceHidden ? "hidden" : "visible" }}
            className="z-50"
            {...getFloatingProps()}
          >
            <CitationPreviewCard target={target} href={href} label={children} rank={rank} />
          </div>
        </FloatingPortal>
      )}

      {target && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="px-4 pt-12 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <SheetTitle className="sr-only">{t("citationPreview.sheetTitle")}</SheetTitle>
            <CitationPreviewBody target={target} label={children} />
            {rank && <CitationRankNote rank={rank} />}
            <CitationCta href={href} onClick={() => setSheetOpen(false)} className="w-full justify-center" />
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
