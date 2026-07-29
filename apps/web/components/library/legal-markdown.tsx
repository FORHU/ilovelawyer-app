import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => <h2 className="font-['Libre_Caslon_Text'] text-2xl text-foreground mt-6 mb-2 first:mt-0">{children}</h2>,
  h2: ({ children }) => <h3 className="font-['Libre_Caslon_Text'] text-xl text-foreground mt-5 mb-2 first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="font-['Libre_Caslon_Text'] text-lg text-foreground mt-4 mb-1 first:mt-0">{children}</h4>,
  h4: ({ children }) => <h5 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mt-4 mb-1 first:mt-0">{children}</h5>,
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-3 last:mb-0 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 last:mb-0 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border pl-4 my-3 italic text-muted-foreground">{children}</blockquote>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 text-blue-900 dark:text-blue-400 hover:no-underline"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="bg-muted rounded px-1 py-0.5 text-[13px] font-mono text-foreground">{children}</code>
  ),
  hr: () => <hr className="my-4 border-border" />,
};

// The API's markdown content often repeats the document's own title as its first
// heading line (e.g. "# G.R. No. 128165"), which callers also render separately
// above this component — producing a visible duplicate. Strip that leading
// heading when it matches the given title so it's shown exactly once.
function stripLeadingDuplicateHeading(markdown: string, title?: string): string {
  if (!title) return markdown;
  const lines = markdown.split("\n");

  let i = 0;
  while (i < lines.length && (lines[i] ?? "").trim() === "") i++;
  const headingLine = lines[i];
  if (headingLine === undefined) return markdown;

  const match = headingLine.match(/^#{1,6}\s+(.*)$/);
  if (!match || (match[1] ?? "").trim().toLowerCase() !== title.trim().toLowerCase()) return markdown;

  let j = i + 1;
  while (j < lines.length && (lines[j] ?? "").trim() === "") j++;
  return lines.slice(j).join("\n");
}

/** Renders legal document markdown (Generated Articles, Case Law Documents) with the Library page's editorial styling. */
export default function LegalMarkdown({ content, title }: { content: string; title?: string }) {
  const body = stripLeadingDuplicateHeading(content, title);
  return (
    <div className="text-sm text-foreground leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {body}
      </ReactMarkdown>
    </div>
  );
}
