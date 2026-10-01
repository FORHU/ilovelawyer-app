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

// A citation reads as a rounded pill in an italic serif, followed by a small badge that says what
// kind of authority it is (Law, Jurisprudence). The pill is tinted by kind (pink for law, blue for
// jurisprudence) until the authority has a ranking; a ranked citation tints by tier instead and
// adds an underline style, so the tier never rides on colour alone: High is solid green, Medium
// dashed amber, Low dotted slate. The badge keeps its kind colour either way.
// box-decoration-clone repeats the padding and rounding on every line of a citation that wraps.
const CITATION_BASE_CLASS =
  "mx-0.5 cursor-pointer box-decoration-clone rounded-md px-1.5 py-0.5 font-['Source_Serif_4'] font-medium italic " +
  "text-foreground transition-colors duration-150 underline-offset-[3px] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold";

type CitationKind = "law" | "jurisprudence";

const CITATION_KIND_CLASS: Record<CitationKind, string> = {
  law:
    "bg-pink-100 hover:bg-pink-200 data-[open]:bg-pink-200 " +
    "dark:bg-fuchsia-900/45 dark:hover:bg-fuchsia-900/60 dark:data-[open]:bg-fuchsia-900/60",
  jurisprudence:
    "bg-sky-100 hover:bg-sky-200 data-[open]:bg-sky-200 " +
    "dark:bg-sky-900/45 dark:hover:bg-sky-900/60 dark:data-[open]:bg-sky-900/60",
};

const CITATION_BADGE_CLASS: Record<CitationKind, string> = {
  law: "bg-pink-300 text-pink-950 dark:bg-fuchsia-700 dark:text-white",
  jurisprudence: "bg-sky-300 text-sky-950 dark:bg-sky-600 dark:text-white",
};

const CITATION_TIER_CLASS: Record<CitationRankTier, string> = {
  HIGH:
    "bg-emerald-100 hover:bg-emerald-200 data-[open]:bg-emerald-200 underline decoration-emerald-600 decoration-solid decoration-2 " +
    "dark:bg-emerald-900/45 dark:hover:bg-emerald-900/60 dark:data-[open]:bg-emerald-900/60 dark:decoration-emerald-400",
  MEDIUM:
    "bg-amber-100 hover:bg-amber-200 data-[open]:bg-amber-200 underline decoration-amber-600 decoration-dashed decoration-[1.5px] " +
    "dark:bg-amber-900/45 dark:hover:bg-amber-900/60 dark:data-[open]:bg-amber-900/60 dark:decoration-amber-400",
  LOW:
    "bg-slate-100 hover:bg-slate-200 data-[open]:bg-slate-200 underline decoration-slate-500 decoration-dotted decoration-[1.5px] " +
    "dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:data-[open]:bg-slate-800 dark:decoration-slate-400",
};

const CITATION_BADGE_BASE_CLASS =
  "ml-1.5 inline-block rounded px-1.5 py-px align-[1px] font-sans text-[11px] font-semibold not-italic leading-4 no-underline";

/** Law or Jurisprudence, from the Library category in the href. */
export function citationKindOf(category: string | undefined): CitationKind | null {
  if (category === "republic-acts" || category === "uk-legislation") return "law";
  if (category === "jurisprudence" || category === "uk-case-law") return "jurisprudence";
  return null;
}

// chat-wonder suffixes a citation's label with a literal " Law" or " Jurisprudence". The badge says
// that now, so it comes off the visible text rather than being shown twice.
const BADGE_SUFFIX_RE = /\s+(Law|Jurisprudence)\s*$/i;
export function stripBadgeSuffix(children: React.ReactNode): React.ReactNode {
  if (typeof children === "string") return children.replace(BADGE_SUFFIX_RE, "");
  if (Array.isArray(children) && children.length && typeof children[children.length - 1] === "string") {
    return [...children.slice(0, -1), (children[children.length - 1] as string).replace(BADGE_SUFFIX_RE, "")];
  }
  return children;
}

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
  const kind = citationKindOf(target?.category);
  // Only strip the suffix when the badge is going to say it instead.
  const label = kind ? stripBadgeSuffix(children) : children;
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
        data-kind={kind ?? undefined}
        className={`${CITATION_BASE_CLASS} ${rank ? CITATION_TIER_CLASS[rank.tier] : kind ? CITATION_KIND_CLASS[kind] : CITATION_KIND_CLASS.law}`}
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
        {label}
        {kind && <span className={`${CITATION_BADGE_BASE_CLASS} ${CITATION_BADGE_CLASS[kind]}`}>{t(`citationBadge.${kind}`)}</span>}
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
            <CitationPreviewCard target={target} href={href} label={label} rank={rank} />
          </div>
        </FloatingPortal>
      )}

      {target && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="px-4 pt-12 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <SheetTitle className="sr-only">{t("citationPreview.sheetTitle")}</SheetTitle>
            <CitationPreviewBody target={target} label={label} />
            {rank && <CitationRankNote rank={rank} />}
            <CitationCta href={href} onClick={() => setSheetOpen(false)} className="w-full justify-center" />
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
