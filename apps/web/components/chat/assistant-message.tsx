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
  em: ({ children }) => <em className="italic font-medium text-[#0b132b]">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 last:mb-0 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 last:mb-0 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-neutral-300 pl-3 my-2 text-neutral-600">{children}</blockquote>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 font-medium text-[#0b132b]"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="bg-neutral-100 rounded px-1 py-0.5 text-[14px] font-mono">{children}</code>
  ),
  hr: () => <hr className="my-3 border-neutral-200" />,
};

// The backend appends a `[RELATED_QUERIES][...][/RELATED_QUERIES]` suffix intended
// to drive a future "suggested follow-up" UI. That feature doesn't exist yet, so
// strip it rather than let it leak into the visible response.
function stripRelatedQueries(content: string): string {
  return content.replace(/\[RELATED_QUERIES\][\s\S]*?\[\/RELATED_QUERIES\]/gi, "").trimEnd();
}

export default function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="text-[15px] leading-6 font-['Inter'] text-[#181c1e]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {stripRelatedQueries(content)}
      </ReactMarkdown>
    </div>
  );
}
