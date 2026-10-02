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

// A citation reads as a bold italic serif pill followed by a small badge that says what kind of
// authority it is (Law, Jurisprudence). Pill and badge are one colour family, light for the pill
// and deeper for the badge. An unranked citation is blue for law and indigo for jurisprudence; a
// ranked one takes its tier colour (green, amber, slate) and an underline style as well.
// box-decoration-clone repeats the padding and rounding on every line of a citation that wraps.
const CITATION_BASE_CLASS =
  "mx-1 cursor-pointer box-decoration-clone rounded-md px-2 py-[3px] font-[family-name:var(--font-reading)] font-bold italic " +
  "tracking-[0.02em] [word-spacing:0.08em] transition-colors duration-150 underline-offset-4 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold";

type CitationKind = "law" | "jurisprudence";
type ColourFamily = "sky" | "indigo" | "emerald" | "amber" | "slate";

// Every citation is one colour family twice: a light tint for the pill and a deeper shade of the
// same colour for its badge, so a green pill carries a green badge and a blue one a blue badge.
const PILL_CLASS: Record<ColourFamily, string> = {
  sky:
    "bg-sky-200 text-sky-950 hover:bg-sky-300 data-[open]:bg-sky-300 " +
    "dark:bg-sky-800 dark:text-white dark:hover:bg-sky-700 dark:data-[open]:bg-sky-700",
  indigo:
    "bg-indigo-200 text-indigo-950 hover:bg-indigo-300 data-[open]:bg-indigo-300 " +
    "dark:bg-indigo-800 dark:text-white dark:hover:bg-indigo-700 dark:data-[open]:bg-indigo-700",
  emerald:
    "bg-emerald-200 text-emerald-950 hover:bg-emerald-300 data-[open]:bg-emerald-300 " +
    "dark:bg-emerald-800 dark:text-white dark:hover:bg-emerald-700 dark:data-[open]:bg-emerald-700",
  amber:
    "bg-amber-200 text-amber-950 hover:bg-amber-300 data-[open]:bg-amber-300 " +
    "dark:bg-amber-800 dark:text-white dark:hover:bg-amber-700 dark:data-[open]:bg-amber-700",
  slate:
    "bg-slate-200 text-slate-900 hover:bg-slate-300 data-[open]:bg-slate-300 " +
    "dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600 dark:data-[open]:bg-slate-600",
};

// The badge is the same colour, deeper, so it reads as part of the pill: strong with white text in
// light mode, bright with dark text in dark mode.
const BADGE_CLASS: Record<ColourFamily, string> = {
  sky: "bg-sky-600 text-white dark:bg-sky-400 dark:text-sky-950",
  indigo: "bg-indigo-600 text-white dark:bg-indigo-400 dark:text-indigo-950",
  emerald: "bg-emerald-600 text-white dark:bg-emerald-400 dark:text-emerald-950",
  amber: "bg-amber-500 text-amber-950 dark:bg-amber-400 dark:text-amber-950",
  slate: "bg-slate-600 text-white dark:bg-slate-400 dark:text-slate-950",
};

// An unranked citation takes its colour from what it is: law is blue, jurisprudence indigo.
const KIND_FAMILY: Record<CitationKind, ColourFamily> = { law: "sky", jurisprudence: "indigo" };

// A ranked citation takes its colour from its tier and adds an underline style, so the tier never
// rides on colour alone: High is a solid green underline, Medium dashed amber, Low dotted slate.
const TIER_FAMILY: Record<CitationRankTier, ColourFamily> = { HIGH: "emerald", MEDIUM: "amber", LOW: "slate" };
const TIER_UNDERLINE_CLASS: Record<CitationRankTier, string> = {
  HIGH: "underline decoration-emerald-700 decoration-solid decoration-2 dark:decoration-emerald-300",
  MEDIUM: "underline decoration-amber-700 decoration-dashed decoration-2 dark:decoration-amber-300",
  LOW: "underline decoration-slate-600 decoration-dotted decoration-2 dark:decoration-slate-300",
};

const CITATION_BADGE_BASE_CLASS =
  "ml-2 inline-block rounded px-1.5 py-px align-[1px] font-sans text-[11px] font-semibold not-italic leading-4 tracking-normal no-underline [word-spacing:normal]";

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
  const family: ColourFamily = rank ? TIER_FAMILY[rank.tier] : KIND_FAMILY[kind ?? "law"];
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
        className={`${CITATION_BASE_CLASS} ${PILL_CLASS[family]}${rank ? ` ${TIER_UNDERLINE_CLASS[rank.tier]}` : ""}`}
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
        {kind && <span className={`${CITATION_BADGE_BASE_CLASS} ${BADGE_CLASS[family]}`}>{t(`citationBadge.${kind}`)}</span>}
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
