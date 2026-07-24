import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => <h2 className="font-['Libre_Caslon_Text'] text-2xl text-black mt-6 mb-2 first:mt-0">{children}</h2>,
  h2: ({ children }) => <h3 className="font-['Libre_Caslon_Text'] text-xl text-black mt-5 mb-2 first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="font-['Libre_Caslon_Text'] text-lg text-black mt-4 mb-1 first:mt-0">{children}</h4>,
  h4: ({ children }) => <h5 className="text-sm font-bold uppercase tracking-wider text-gray-700 mt-4 mb-1 first:mt-0">{children}</h5>,
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-bold text-black">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-3 last:mb-0 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 last:mb-0 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-gray-300 pl-4 my-3 italic text-gray-600">{children}</blockquote>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 text-blue-900 hover:no-underline"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="bg-gray-100 rounded px-1 py-0.5 text-[13px] font-mono">{children}</code>
  ),
  hr: () => <hr className="my-4 border-gray-200" />,
};

/** Renders legal document markdown (Generated Articles, Case Law Documents) with the Library page's editorial styling. */
export default function LegalMarkdown({ content }: { content: string }) {
  return (
    <div className="text-sm text-gray-800 leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
