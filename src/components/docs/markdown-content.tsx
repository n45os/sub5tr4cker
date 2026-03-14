import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="docs-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            if (!href) return <>{children}</>;
            const isExternal = href.startsWith("http");
            if (isExternal) {
              return (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              );
            }
            return <Link href={href}>{children}</Link>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
