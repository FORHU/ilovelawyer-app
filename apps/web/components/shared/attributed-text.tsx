import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { findClaimMatches, type Claim, type ClaimCategory } from "./attributed-text-match";

export type { Claim, ClaimCategory } from "./attributed-text-match";

/* Colors are CSS vars (see packages/ui/src/styles/globals.css) so dark mode can swap in
   lighter foregrounds instead of the light-mode shades going illegible on a near-black background. */
const CATEGORY_STYLE: Record<ClaimCategory, { bg: string; color: string; label: string }> = {
  GROUNDED: { bg: "var(--claim-grounded-bg)", color: "var(--claim-grounded-fg)", label: "Grounded in case data" },
  INFERENCE: { bg: "var(--claim-inference-bg)", color: "var(--claim-inference-fg)", label: "AI inference" },
  UNSUPPORTED: { bg: "var(--claim-unsupported-bg)", color: "var(--claim-unsupported-fg)", label: "Unsupported" },
};
// `category` comes from the model's own [CLAIMS] block, not a value this app controls — a
// category outside the 3 above (an off-spec/malformed generation) must not crash the whole
// markdown render over one highlighted span.
const FALLBACK_CATEGORY_STYLE = { bg: "rgba(107,114,128,0.16)", color: "#374151", label: "Unlabeled" };

/** Wraps each of findClaimMatches' spans in a highlighted <mark>, leaving everything else
 * untouched — see attributed-text-match.ts for the (JSX-free, unit-tested) matching logic. */
export function highlightText(input: string, claims: Claim[]): React.ReactNode[] {
  const matches = findClaimMatches(input, claims);
  if (matches.length === 0) return [input];

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.start > cursor) nodes.push(input.slice(cursor, m.start));
    const style = CATEGORY_STYLE[m.claim.category] ?? FALLBACK_CATEGORY_STYLE;
    const title = m.claim.sourceLabel ? `${style.label} - ${m.claim.sourceLabel}` : style.label;
    nodes.push(
      <mark
        key={`claim-${i}-${m.start}`}
        title={title}
        // Soft underline plus a faint tint, not a filled block: per-sentence fills fight long-form reading.
        style={{
          backgroundColor: style.bg,
          color: "inherit",
          borderRadius: 2,
          textDecoration: "underline",
          textDecorationColor: style.color,
          textDecorationThickness: 2,
          textUnderlineOffset: 4,
          padding: "0 1px",
        }}
      >
        {input.slice(m.start, m.end)}
      </mark>,
    );
    cursor = m.end;
  });
  if (cursor < input.length) nodes.push(input.slice(cursor));
  return nodes;
}

// Only plain string children get highlighted — a sentence already wrapped in bold/italic/link
// by markdown is left as-is. Red Team's prose is almost entirely plain paragraphs and list
// items, so this covers the load-bearing case without the complexity of matching across
// nested-element boundaries.
function highlightChildren(children: React.ReactNode, claims: Claim[]): React.ReactNode {
  return React.Children.map(children, (child) => (typeof child === "string" ? highlightText(child, claims) : child));
}

/** Same visual styling as components/library/legal-markdown.tsx, kept as its own component
 * (not a shared export) so this doesn't risk changing that component's behavior elsewhere. */
function buildComponents(claims: Claim[]): Components {
  return {
    h1: ({ children }) => <h2 className="text-[17px] font-semibold tracking-tight text-foreground mt-6 mb-2 first:mt-0">{children}</h2>,
    h2: ({ children }) => <h3 className="text-base font-semibold tracking-tight text-foreground mt-5 mb-2 first:mt-0">{children}</h3>,
    h3: ({ children }) => <h4 className="text-[15px] font-semibold text-foreground mt-4 mb-1 first:mt-0">{children}</h4>,
    h4: ({ children }) => <h5 className="font-sans text-xs font-semibold text-foreground/70 mt-4 mb-1 first:mt-0">{children}</h5>,
    p: ({ children }) => <p className="mb-4 last:mb-0">{highlightChildren(children, claims)}</p>,
    strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    ul: ({ children }) => <ul className="list-disc pl-5 mb-4 last:mb-0 space-y-1.5 marker:text-foreground/50">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-5 mb-4 last:mb-0 space-y-1.5 marker:text-foreground/50">{children}</ol>,
    li: ({ children }) => <li className="pl-1">{highlightChildren(children, claims)}</li>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-brand-gold/40 pl-4 my-4 italic text-foreground/80">{children}</blockquote>
    ),
    a: ({ children, href }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 text-blue-900 dark:text-blue-400 hover:no-underline">
        {children}
      </a>
    ),
    code: ({ children }) => <code className="bg-muted rounded px-1 py-0.5 text-[13px] font-mono text-foreground">{children}</code>,
    hr: () => <hr className="my-4 border-border" />,
  };
}

export function AttributedTextLegend({
  counts,
  className = "flex-wrap items-center gap-x-3 gap-y-1",
}: {
  counts?: Partial<Record<ClaimCategory, number>>;
  className?: string;
} = {}) {
  const entries = Object.entries(CATEGORY_STYLE) as [ClaimCategory, (typeof CATEGORY_STYLE)[ClaimCategory]][];
  return (
    <div className={`flex text-[11px] text-foreground/70 ${className}`}>
      {entries.map(([category, style]) => (
        <span key={category} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: style.bg, boxShadow: `inset 0 -2px 0 ${style.color}` }} />
          {style.label}
          {counts && <span className="font-semibold text-foreground tabular-nums">{counts[category] ?? 0}</span>}
        </span>
      ))}
    </div>
  );
}

/** Markdown renderer with per-sentence claim attribution — hover a highlighted phrase to see
 * why it's colored the way it is. `claims` matching happens at render time against whatever
 * `content` currently is, so nothing about the stored text is ever modified. */
export default function AttributedMarkdown({ content, claims }: { content: string; claims: Claim[] }) {
  const components = React.useMemo(() => buildComponents(claims), [claims]);
  return (
    // Reading face (--font-reading, loaded in app/layout.tsx, same as chat answers) at a book-like measure.
    <div className="max-w-[66ch] font-[family-name:var(--font-reading)] text-[15px] leading-7 text-pretty text-foreground selection:bg-brand-gold/20">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
