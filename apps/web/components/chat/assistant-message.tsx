import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

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
  code: ({ children }) => (
    <code className="bg-muted rounded px-1 py-0.5 text-[14px] font-mono">{children}</code>
  ),
  hr: () => <hr className="my-3 border-border" />,
};

// The backend appends a `[RELATED_QUERIES][...][/RELATED_QUERIES]` suffix intended
// to drive a future "suggested follow-up" UI. That feature doesn't exist yet, so
// strip it rather than let it leak into the visible response.
function stripRelatedQueries(content: string): string {
  return content.replace(/\[RELATED_QUERIES\][\s\S]*?\[\/RELATED_QUERIES\]/gi, "").trimEnd();
}

// Chat Wonder sometimes cites controlling authorities as literal `<a href="...">text</a>`
// HTML anchors rather than markdown link syntax. react-markdown doesn't render embedded
// raw HTML (by design, to avoid piping untrusted LLM output straight into the DOM), so
// left alone these show up as literal tag text. Convert them to markdown links instead
// of turning on raw HTML rendering.
function convertHtmlAnchors(content: string): string {
  return content.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");
}

export default function AssistantMessage({ content, className }: { content: string; className?: string }) {
  const cleaned = convertHtmlAnchors(stripRelatedQueries(content));
  return (
    <div className={`text-[15px] leading-6 font-['Inter'] ${className ?? "text-foreground"}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {cleaned}
      </ReactMarkdown>
    </div>
  );
}

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
