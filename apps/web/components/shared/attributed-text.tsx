import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { findClaimMatches, type Claim, type ClaimCategory } from "./attributed-text-match";

export type { Claim, ClaimCategory } from "./attributed-text-match";

const CATEGORY_STYLE: Record<ClaimCategory, { bg: string; color: string; label: string }> = {
  GROUNDED: { bg: "rgba(59,130,246,0.16)", color: "#1d4ed8", label: "Grounded in case data" },
  INFERENCE: { bg: "rgba(217,119,6,0.18)", color: "#b45309", label: "AI inference" },
  UNSUPPORTED: { bg: "rgba(220,38,38,0.16)", color: "#b91c1c", label: "Unsupported" },
};

/** Wraps each of findClaimMatches' spans in a highlighted <mark>, leaving everything else
 * untouched — see attributed-text-match.ts for the (JSX-free, unit-tested) matching logic. */
export function highlightText(input: string, claims: Claim[]): React.ReactNode[] {
  const matches = findClaimMatches(input, claims);
  if (matches.length === 0) return [input];

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.start > cursor) nodes.push(input.slice(cursor, m.start));
    const style = CATEGORY_STYLE[m.claim.category];
    const title = m.claim.sourceLabel ? `${style.label} — ${m.claim.sourceLabel}` : style.label;
    nodes.push(
      <mark
        key={`claim-${i}-${m.start}`}
        title={title}
        style={{ backgroundColor: style.bg, color: style.color, borderRadius: 3, padding: "0 2px" }}
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
    h1: ({ children }) => <h2 className="font-['Libre_Caslon_Text'] text-2xl text-foreground mt-6 mb-2 first:mt-0">{children}</h2>,
    h2: ({ children }) => <h3 className="font-['Libre_Caslon_Text'] text-xl text-foreground mt-5 mb-2 first:mt-0">{children}</h3>,
    h3: ({ children }) => <h4 className="font-['Libre_Caslon_Text'] text-lg text-foreground mt-4 mb-1 first:mt-0">{children}</h4>,
    h4: ({ children }) => <h5 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mt-4 mb-1 first:mt-0">{children}</h5>,
    p: ({ children }) => <p className="mb-3 last:mb-0">{highlightChildren(children, claims)}</p>,
    strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    ul: ({ children }) => <ul className="list-disc pl-5 mb-3 last:mb-0 space-y-1">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 last:mb-0 space-y-1">{children}</ol>,
    li: ({ children }) => <li className="pl-1">{highlightChildren(children, claims)}</li>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-border pl-4 my-3 italic text-muted-foreground">{children}</blockquote>
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

export function AttributedTextLegend() {
  const entries = Object.entries(CATEGORY_STYLE) as [ClaimCategory, (typeof CATEGORY_STYLE)[ClaimCategory]][];
  return (
    <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
      {entries.map(([category, style]) => (
        <span key={category} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: style.bg, boxShadow: `inset 0 0 0 1px ${style.color}` }} />
          {style.label}
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
    <div className="text-sm text-foreground leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
