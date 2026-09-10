import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { MermaidDiagram } from "./mermaid-diagram";

// TODO: links currently open in a new tab. Revisit once it's decided whether
// citations should navigate externally or open in an in-app sidebar instead.
const components: Components = {
  h1: ({ children }) => <p className="text-[18px] font-bold mt-4 mb-1 first:mt-0">{children}</p>,
  h2: ({ children }) => <p className="text-[17px] font-bold mt-4 mb-1 first:mt-0">{children}</p>,
  h3: ({ children }) => <p className="text-[16px] font-bold mt-3 mb-1 first:mt-0">{children}</p>,
  h4: ({ children }) => <p className="text-[16px] font-bold mt-3 mb-1 first:mt-0">{children}</p>,
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic font-medium text-primary">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 last:mb-0 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 last:mb-0 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border pl-3 my-2 text-muted-foreground">{children}</blockquote>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 font-medium text-primary"
    >
      {children}
    </a>
  ),
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

// Memoized: this re-parses `content` through ReactMarkdown on every render, which is real
// CPU cost for a long reply. Without memo, typing in the chat input (a sibling state update
// in the same parent, ConsultationChat) re-rendered every message bubble in the transcript on
// every keystroke, including re-parsing markdown for messages that haven't changed at all —
// the more/longer the conversation, the worse the input lag got.
const AssistantMessage = React.memo(function AssistantMessage({ content, className }: { content: string; className?: string }) {
  const cleaned = convertHtmlAnchors(stripRelatedQueries(stripTraceBlocks(content)));
  return (
    <div className={`text-[15px] leading-6 font-['Inter'] ${className ?? "text-foreground"}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {cleaned}
      </ReactMarkdown>
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
