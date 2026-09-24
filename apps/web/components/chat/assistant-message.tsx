import React from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { isInternalLibraryHref } from "@/lib/law/internal-library-link";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { useTranslation } from "react-i18next";
import { CircleHelp, Info, ChevronDown, ChevronRight } from "lucide-react";
import { MermaidDiagram } from "./mermaid-diagram";
import { findAnchorMatches } from "@/components/shared/decision-anchor-match";
import { DecisionConfidenceBadge, DecisionDetailBody } from "@/components/shared/decision-detail";
import { decisionAnchorElementId, reapplyFallbackHighlight } from "@/lib/chat/use-topic-navigator";
import { useActiveHighlightStore } from "@/lib/store/active-highlight.store";
import type { DecisionRecordPayload } from "@/lib/terminal/types";
import type { MessageGroundingCheck } from "@/lib/chat/mutations";
import { GroundingSummary } from "./grounding-summary";

/** One piece of evidence's quote (evidenceFor/evidenceAgainst), searched for and highlighted
 * yellow wherever it actually appears in a reply — see SourcesPanel, which builds this list from
 * the same turn's decisions and supplies `id` via evidenceQuoteElementId, so its Evidence rows
 * can jump straight to the quoted sentence instead of just the message it happened to land in. */
export interface QuoteHighlight {
  id: string;
  text: string;
}

const NO_QUOTE_HIGHLIGHTS: QuoteHighlight[] = [];

// A Decision Record's `anchor` is a verbatim sentence chat-wonder-v2-api copied from this same
// answer and already verified against it server-side (whitespace-normalized substring check —
// see findAnchorMatches). Highlighting it here lets a lawyer click straight to the "Why?" for
// that conclusion instead of only finding it in the case-level Decisions panel — dotted
// underline, opens the drawer, always on. Evidence quotes (`quoteHighlights`) are the opposite:
// invisible (plain text, id-only) until SourcesPanel's Evidence rows are clicked — only the one
// matching `activeHighlightId` (active-highlight.store.ts, "one at a time," a new click replaces
// the last) actually turns yellow, so the chat doesn't read as pre-highlighted everywhere a quote
// happens to appear. Both share one findAnchorMatches call (longest-first, non-overlapping) so a
// decision anchor and a quote can never fight over the same span. Each span still carries its
// stable DOM id (decisionAnchorElementId / the quote's own `id`) even while inactive — Case
// Workspace's Sources panel (use-topic-navigator.ts's scrollToElementId) needs it to exist
// already, since the id is what a click scrolls (and un/highlights) to. `messageIndex` is only
// used for decision-anchor ids — optional since only ConsultationChat's transcript render (which
// knows each bubble's visibleMessages index) can supply it; quote ids don't need it (see
// evidenceQuoteElementId's doc comment — a quote isn't scoped to one message).
function highlightAnchorsAndQuotes(
  text: string,
  decisions: DecisionRecordPayload[],
  onOpenDecision: (decision: DecisionRecordPayload) => void,
  messageIndex: number | undefined,
  quoteHighlights: QuoteHighlight[],
  activeHighlightId: string | null,
): React.ReactNode[] {
  const decisionTargets = decisions.map((d, i) => ({ id: `decision-${i}`, anchor: d.anchor }));
  const quoteTargets = quoteHighlights.map((q) => ({ id: q.id, anchor: q.text }));
  const matches = findAnchorMatches(text, [...decisionTargets, ...quoteTargets]);
  if (matches.length === 0) return [text];

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.start > cursor) nodes.push(text.slice(cursor, m.start));
    if (m.decisionId.startsWith("decision-")) {
      const decisionIndex = Number(m.decisionId.slice("decision-".length));
      const decision = decisions[decisionIndex]!;
      nodes.push(
        <span
          key={`decision-${i}-${m.start}`}
          id={messageIndex !== undefined ? decisionAnchorElementId(messageIndex, decisionIndex) : undefined}
          role="button"
          tabIndex={0}
          onClick={() => onOpenDecision(decision)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpenDecision(decision);
            }
          }}
          className="cursor-pointer rounded-sm underline decoration-dotted decoration-brand-gold underline-offset-2 hover:bg-brand-gold/10"
        >
          {text.slice(m.start, m.end)}
          <CircleHelp className="ml-0.5 inline h-3 w-3 -translate-y-px text-brand-gold" aria-hidden="true" />
        </span>,
      );
    } else if (m.decisionId === activeHighlightId) {
      nodes.push(
        <mark
          key={`quote-${i}-${m.start}`}
          id={m.decisionId}
          className="rounded-sm bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-500/30"
        >
          {text.slice(m.start, m.end)}
        </mark>,
      );
    } else {
      // Not the active one — same span, no highlight styling, just carries the id so a later
      // click can still find and highlight it (see the doc comment above).
      nodes.push(
        <span key={`quote-${i}-${m.start}`} id={m.decisionId}>
          {text.slice(m.start, m.end)}
        </span>,
      );
    }
    cursor = m.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

// Only plain string children get the anchor highlight — same restriction as
// components/shared/attributed-text.tsx's highlightChildren, and for the same reason: a
// conclusion already wrapped in bold/italic/link by markdown is left alone rather than risking
// a match split across element boundaries.
function highlightChildren(
  children: React.ReactNode,
  decisions: DecisionRecordPayload[],
  onOpenDecision: (decision: DecisionRecordPayload) => void,
  messageIndex: number | undefined,
  quoteHighlights: QuoteHighlight[],
  activeHighlightId: string | null,
): React.ReactNode {
  if (decisions.length === 0 && quoteHighlights.length === 0) return children;
  return React.Children.map(children, (child) =>
    typeof child === "string"
      ? highlightAnchorsAndQuotes(child, decisions, onOpenDecision, messageIndex, quoteHighlights, activeHighlightId)
      : child,
  );
}

function buildComponents(
  decisions: DecisionRecordPayload[],
  onOpenDecision: (decision: DecisionRecordPayload) => void,
  messageIndex: number | undefined,
  quoteHighlights: QuoteHighlight[],
  activeHighlightId: string | null,
): Components {
  return {
    h1: ({ children }) => <p className="text-[18px] font-bold mt-4 mb-1 first:mt-0">{children}</p>,
    h2: ({ children }) => <p className="text-[17px] font-bold mt-4 mb-1 first:mt-0">{children}</p>,
    h3: ({ children }) => <p className="text-[16px] font-bold mt-3 mb-1 first:mt-0">{children}</p>,
    h4: ({ children }) => <p className="text-[16px] font-bold mt-3 mb-1 first:mt-0">{children}</p>,
    p: ({ children }) => (
      <p className="mb-2 last:mb-0">
        {highlightChildren(children, decisions, onOpenDecision, messageIndex, quoteHighlights, activeHighlightId)}
      </p>
    ),
    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
    em: ({ children }) => <em className="italic font-medium text-primary">{children}</em>,
    ul: ({ children }) => <ul className="list-disc pl-5 mb-2 last:mb-0 space-y-1">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 last:mb-0 space-y-1">{children}</ol>,
    li: ({ children }) => (
      <li className="pl-1">
        {highlightChildren(children, decisions, onOpenDecision, messageIndex, quoteHighlights, activeHighlightId)}
      </li>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-border pl-3 my-2 text-muted-foreground">{children}</blockquote>
    ),
    a: ({ children, href }) => {
      if (isInternalLibraryHref(href)) {
        return (
          <Link href={href} className="underline underline-offset-2 font-medium text-primary">
            {children}
          </Link>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 font-medium text-primary"
        >
          {children}
        </a>
      );
    },
    code: ({ className, children }) => {
      if (className?.includes("language-mermaid")) {
        return <MermaidDiagram chart={String(children)} />;
      }
      return <code className="bg-muted rounded px-1 py-0.5 text-[14px] font-mono">{children}</code>;
    },
    // Fenced code blocks come wrapped in a `<pre>` by default; unwrap it for mermaid
    // fences so the diagram isn't nested inside a `<pre>` with its own monospace/box styling.
    // Everything else (plain code, or ASCII-art diagrams the model draws instead of using
    // mermaid/the mind-map tag) gets a proper scrollable code card instead of a cramped,
    // unbounded wall of monospace text — the `[&>code]:*` resets cancel the inline chip
    // styling on the `code` component below so it doesn't double up inside this box.
    pre: ({ children }) => {
      const child = Array.isArray(children) ? children[0] : children;
      const isMermaid =
        React.isValidElement<{ className?: string }>(child) && child.props.className?.includes("language-mermaid");
      if (isMermaid) return <>{children}</>;
      return (
        <pre className="my-3 rounded-xl border border-border bg-muted/60 p-3 overflow-x-auto text-[13px] leading-relaxed [&>code]:bg-transparent [&>code]:p-0 [&>code]:rounded-none">
          {children}
        </pre>
      );
    },
    hr: () => <hr className="my-3 border-border" />,
    // remark-gfm parses tables but react-markdown otherwise emits bare <table>/<td> with no
    // borders, padding, or header styling — without this it renders as loosely stacked text.
    table: ({ children }) => (
      <div className="my-3 overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-[14px]">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
    tr: ({ children }) => (
      <tr className="border-b border-border last:border-b-0 [&:nth-child(even)]:bg-muted/30">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="px-3 py-2 text-left font-bold border-r border-border last:border-r-0">{children}</th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 align-top border-r border-border last:border-r-0">{children}</td>
    ),
  };
}

// Compact confidence + "would change if" summary shown directly on the reply, below the
// highlighted anchor text — so a cautious/contested answer reads as cautious without an extra
// click. Expands in place into the full DecisionDetailBody (rule, evidence for/against,
// alternatives, weighting) on click, dropdown-style — not the DecisionDrawer the inline anchor
// highlight above opens for this same decision; a second side panel for what's already right
// here in the transcript read as a worse interaction than just expanding downward.
function DecisionSummaryRow({ decision }: { decision: DecisionRecordPayload }) {
  const { t } = useTranslation("terminal");
  const [open, setOpen] = React.useState(false);
  const wouldChangeIf = decision.wouldChangeIf;
  return (
    <div className="mt-1.5 rounded-lg border border-border/60 text-[12px] leading-4 text-muted-foreground">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className="flex cursor-pointer flex-wrap items-start gap-x-2 gap-y-1 px-2.5 py-1.5 transition-colors hover:bg-muted/60"
      >
        <DecisionConfidenceBadge confidence={decision.confidence} />
        {wouldChangeIf.length > 0 && (
          <span className="flex min-w-0 flex-1 items-start gap-1">
            <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate">
              <span className="font-semibold text-foreground">{t("decisionWouldChangeIf")}: </span>
              {wouldChangeIf[0]}
              {wouldChangeIf.length > 1 && t("decisionWouldChangeIfMore", { count: wouldChangeIf.length - 1 })}
            </span>
          </span>
        )}
        {open ? (
          <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      {open && (
        <div className="space-y-2 border-t border-border/60 px-2.5 py-2">
          <DecisionDetailBody payload={decision} />
        </div>
      )}
    </div>
  );
}

// The backend appends a `[RELATED_QUERIES][...][/RELATED_QUERIES]` suffix intended
// to drive a future "suggested follow-up" UI. That feature doesn't exist yet, so
// strip it rather than let it leak into the visible response.
function stripRelatedQueries(content: string): string {
  return content.replace(/\[RELATED_QUERIES\][\s\S]*?\[\/RELATED_QUERIES\]/gi, "").trimEnd();
}

// Defense-in-depth for messages persisted before ilovelawyer-api's response-parser.ts
// started stripping [TRACE]...[/TRACE] glass-box research-step frames (chat-wonder-v2-api's
// streaming_run_function_chain) from Message.content — those older rows still carry raw
// trace JSON at the front of their saved text. New messages come back already clean; this
// is a no-op for them.
function stripTraceBlocks(content: string): string {
  return content.replace(/\[TRACE\][\s\S]*?\[\/TRACE\]/gi, "").trimStart();
}

// Chat Wonder sometimes cites controlling authorities as literal `<a href="...">text</a>`
// HTML anchors rather than markdown link syntax. react-markdown doesn't render embedded
// raw HTML (by design, to avoid piping untrusted LLM output straight into the DOM), so
// left alone these show up as literal tag text. Convert them to markdown links instead
// of turning on raw HTML rendering.
function convertHtmlAnchors(content: string): string {
  return content.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");
}

// Same cleanup the component applies before handing text to ReactMarkdown — exported so
// callers that need the plain text of a reply (e.g. a "copy response" action) copy what the
// user actually sees rather than raw trace/related-queries markup.
export function cleanAssistantContent(content: string): string {
  return convertHtmlAnchors(stripRelatedQueries(stripTraceBlocks(content)));
}

// Memoized: this re-parses `content` through ReactMarkdown on every render, which is real
// CPU cost for a long reply. Without memo, typing in the chat input (a sibling state update
// in the same parent, ConsultationChat) re-rendered every message bubble in the transcript on
// every keystroke, including re-parsing markdown for messages that haven't changed at all —
// the more/longer the conversation, the worse the input lag got.
const NO_DECISIONS: DecisionRecordPayload[] = [];

const AssistantMessage = React.memo(function AssistantMessage({
  content,
  className,
  decisions = NO_DECISIONS,
  onOpenDecision,
  messageIndex,
  quoteHighlights = NO_QUOTE_HIGHLIGHTS,
  groundingChecks,
}: {
  content: string;
  className?: string;
  /** This message's audited Decision Records (see legal_decisions.py) — each `anchor` gets
   * highlighted in the rendered text below, clickable to open its "Why?" detail. Omit/empty for
   * a plain reply, or while the persisted turn (and its decisions) hasn't loaded yet. */
  decisions?: DecisionRecordPayload[];
  onOpenDecision?: (decision: DecisionRecordPayload) => void;
  /** This bubble's index in ConsultationChat's visibleMessages — only used to id each highlighted
   * decision anchor (decisionAnchorElementId) so Case Workspace's Sources panel can scroll to a
   * specific decision's sentence rather than just this whole message. Omit where nothing needs to
   * scroll here by index (the id is simply left off those spans). */
  messageIndex?: number;
  /** Evidence quotes (from this reply's decisions, wherever they actually landed among a split
   * reply's sibling bubbles) to highlight yellow if they appear in THIS bubble's text — see
   * ConsultationChat, which builds one list per turn and hands it to every sibling, since only
   * the split reply's last bubble carries `decisions` but a quote can be in any of them. */
  quoteHighlights?: QuoteHighlight[];
  /** What the grounding verifier found for this reply — rendered as one line underneath, and
   * omitted entirely when absent (the verifier is flag-gated on the API, and a freshly streamed
   * reply has none until the next messages fetch). */
  groundingChecks?: MessageGroundingCheck[];
}) {
  const cleaned = cleanAssistantContent(content);
  // Subscribed directly (not a prop) so a click anywhere that calls setActiveHighlight —
  // currently only SourcesPanel — re-renders every bubble to move the highlight, without
  // ConsultationChat needing to know or forward that state itself.
  const activeHighlightId = useActiveHighlightStore((s) => s.activeHighlightId);
  const components = React.useMemo(
    () => buildComponents(decisions, onOpenDecision ?? (() => {}), messageIndex, quoteHighlights, activeHighlightId),
    [decisions, onOpenDecision, messageIndex, quoteHighlights, activeHighlightId],
  );
  // A new `components` object (any prop/highlight change above) remounts every <p>/<li> in this
  // bubble, dropping the paragraph-level highlight SourcesPanel put on one of them — see
  // use-topic-navigator.ts's applyFallbackHighlight. Re-applied here, after the DOM commit but
  // before paint, on every render (cheap: a no-op unless that highlight lives in this bubble).
  React.useLayoutEffect(() => {
    if (messageIndex !== undefined) reapplyFallbackHighlight(messageIndex);
  });
  return (
    <div className={`text-[15px] leading-6 font-['Inter'] ${className ?? "text-foreground"}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {cleaned}
      </ReactMarkdown>
      {decisions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {decisions.map((decision, i) => (
            <DecisionSummaryRow key={i} decision={decision} />
          ))}
        </div>
      )}
      <GroundingSummary checks={groundingChecks} />
    </div>
  );
});
export default AssistantMessage;

// Shown in place of the assistant bubble from the moment a send fires until the
// first streamed chunk lands — mirrors the brand wordmark so the wait state still
// reads as "ilovelawyer", not a generic spinner.
export function ThinkingIndicator({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 text-[15px] font-['Inter']">
      <span className="font-['Source_Serif_4'] text-muted-foreground">
        ilove<span className="text-[#d4af37] font-semibold">lawyer</span>
      </span>
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-0.5" aria-hidden="true">
        <span className="size-1 rounded-full bg-muted-foreground/70 animate-bounce motion-reduce:animate-none [animation-delay:-0.3s]" />
        <span className="size-1 rounded-full bg-muted-foreground/70 animate-bounce motion-reduce:animate-none [animation-delay:-0.15s]" />
        <span className="size-1 rounded-full bg-muted-foreground/70 animate-bounce motion-reduce:animate-none" />
      </span>
    </div>
  );
}
