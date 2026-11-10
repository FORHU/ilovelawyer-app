"use client";

// Confidence view's controls: the on/off toggle (Consultation header, Case Workspace chat strip,
// every reply's action row), the legend shown while it's on, and the per-answer summary Case
// Studio lists. The shading itself is lib/chat/confidence-rehype.ts, applied in AssistantMessage.
// One global switch (lib/store/confidence-view.store.ts): turning it on anywhere turns it on
// everywhere. See ilovelawyer-api docs/plans/confidence-view-integration.md.

import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Highlighter } from "lucide-react";
import { useConfidenceViewStore } from "@/lib/store/confidence-view.store";
import {
  CONFIDENCE_SWATCH_CLASS,
  CONFIDENCE_TIERS,
  countConfidence,
  type ConfidenceSpan,
  type ConfidenceTier,
} from "@/lib/chat/confidence";

const TIER_KEY: Record<ConfidenceTier, string> = {
  QUOTED: "quoted",
  SOURCED: "sourced",
  UNSOURCED: "unsourced",
};

const TIER_DEFAULT: Record<ConfidenceTier, string> = {
  QUOTED: "Quoted from source",
  SOURCED: "Conclusion from a source",
  UNSOURCED: "No source",
};

/** Reads the remembered on/off choice once, after mount (see the store's comment). */
function useHydratedConfidenceView() {
  const hydrate = useConfidenceViewStore((s) => s.hydrate);
  React.useEffect(() => hydrate(), [hydrate]);
  return useConfidenceViewStore((s) => s.on);
}

export function ConfidenceViewToggle({
  variant = "header",
  className = "",
}: {
  /** "header": icon + label pill (Consultation header, Case Workspace chat strip). "compact" /
   * "icon": icon-only, sized like the reply action row's Copy button (compact = embedded panels). */
  variant?: "header" | "icon" | "compact";
  className?: string;
}) {
  const { t } = useTranslation("homepage");
  const on = useHydratedConfidenceView();
  const toggle = useConfidenceViewStore((s) => s.toggle);
  const label = t("confidenceView.toggle", { defaultValue: "Confidence view" });
  const hint = on
    ? t("confidenceView.hideHint", { defaultValue: "Hide where each sentence came from" })
    : t("confidenceView.showHint", { defaultValue: "Show where each sentence came from" });

  if (variant === "header") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={on}
        title={hint}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[10px] uppercase tracking-[1px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
          on
            ? "border-brand-gold bg-brand-gold/10 text-foreground"
            : "border-border text-muted-foreground hover:border-foreground/60 hover:text-foreground"
        } ${className}`}
      >
        <Highlighter className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </button>
    );
  }

  const iconSize = variant === "compact" ? "h-4 w-4" : "h-6 w-6";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={label}
      title={`${label}: ${hint}`}
      className={`inline-flex items-center justify-center rounded-md transition-colors hover:bg-muted ${
        variant === "compact" ? "p-1.5" : "p-2"
      } ${on ? "bg-brand-gold/10 text-brand-gold" : "text-muted-foreground hover:text-foreground"} ${className}`}
    >
      <Highlighter className={iconSize} aria-hidden="true" />
    </button>
  );
}

/** Shown while Confidence view is on. Says what the colours mean — and, as plainly, what they
 * don't: shading is provenance, never correctness. */
export function ConfidenceLegend({ className = "" }: { className?: string }) {
  const { t } = useTranslation("homepage");
  const on = useHydratedConfidenceView();
  if (!on) return null;
  return (
    <div
      role="note"
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] leading-4 text-muted-foreground ${className}`}
    >
      <span>
        <span className="font-semibold text-foreground">{t("confidenceView.legendTitle", { defaultValue: "Confidence view" })}</span>{" "}
        {t("confidenceView.legendBody", {
          defaultValue: "shows where each sentence came from, not whether it is correct.",
        })}
      </span>
      {CONFIDENCE_TIERS.map((tier) => (
        <span key={tier} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${CONFIDENCE_SWATCH_CLASS[tier]}`} aria-hidden="true" />
          {t(`confidenceView.tier.${TIER_KEY[tier]}`, { defaultValue: TIER_DEFAULT[tier] })}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-4 rounded-full ring-2 ring-emerald-500/70" aria-hidden="true" />
        {t("confidenceView.linkRing", { defaultValue: "Link to a source the AI retrieved" })}
      </span>
    </div>
  );
}

/** One answer's breakdown for Case Studio: a proportional bar, counts per tier, and the "No
 * source" sentences — the review list a lawyer actually wants (what in this answer isn't backed
 * by anything retrieved). Clicking one jumps to it in the chat with the shading on. */
export function ConfidenceSummary({
  spans,
  onJump,
}: {
  spans: ConfidenceSpan[];
  /** Called with the span's index in `spans` (its DOM id is confidenceSpanElementId(turn, index)). */
  onJump?: (spanIndex: number, span: ConfidenceSpan) => void;
}) {
  const { t } = useTranslation("homepage");
  const setOn = useConfidenceViewStore((s) => s.setOn);
  const [open, setOpen] = React.useState(false);
  const prose = React.useMemo(() => spans.filter((s) => s.source !== "citation"), [spans]);
  const counts = React.useMemo(() => countConfidence(prose), [prose]);
  const unsourced = React.useMemo(
    () =>
      spans
        .map((span, index) => ({ span, index }))
        .filter(({ span }) => span.source !== "citation" && span.tier === "UNSOURCED"),
    [spans],
  );
  if (counts.total === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        {CONFIDENCE_TIERS.map((tier) =>
          counts[tier] > 0 ? (
            <span
              key={tier}
              className={CONFIDENCE_SWATCH_CLASS[tier]}
              style={{ width: `${(counts[tier] / counts.total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {CONFIDENCE_TIERS.map((tier) => (
          <span key={tier} className="inline-flex items-center gap-1">
            <span className={`h-2 w-2 rounded-sm ${CONFIDENCE_SWATCH_CLASS[tier]}`} aria-hidden="true" />
            {t(`confidenceView.tier.${TIER_KEY[tier]}`, { defaultValue: TIER_DEFAULT[tier] })}: {counts[tier]}
          </span>
        ))}
      </div>
      {unsourced.length > 0 && (
        <div className="rounded-md border border-border">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[11.5px] font-medium text-foreground"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
              aria-hidden="true"
            />
            {t("confidenceView.unsourcedList", { defaultValue: "No source behind these", count: unsourced.length })}
            <span className="ml-auto text-muted-foreground">{unsourced.length}</span>
          </button>
          {open && (
            <ul className="flex flex-col gap-1 border-t border-border px-2.5 py-2">
              {unsourced.map(({ span, index }) => (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => {
                      setOn(true);
                      onJump?.(index, span);
                    }}
                    className="w-full rounded-sm px-1 py-0.5 text-left text-[12px] leading-4 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title={t("confidenceView.jumpHint", { defaultValue: "Show in chat" })}
                  >
                    {span.quote}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
