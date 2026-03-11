"use client";

import { CodeBlock } from "@/components/ai-elements/code-block";
import { CitationBadge } from "@/components/chat/citation-badge";
import { memo } from "react";
import { Streamdown } from "streamdown";

/** Parse [filename, p.N], [filename, p.N, doc: ID], and [filename, p.N, doc: ID, sec: Section] patterns */
export function renderWithCitations(text: string): React.ReactNode[] {
  const CITATION_RE =
    /\[([^\],]+),\s*p\.(\d+)(?:,\s*doc(?:ument)?\s*:\s*([^,\]]+))?(?:,\s*sec(?:tion)?\s*:\s*([^\]]+))?\]/gi;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = CITATION_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <CitationBadge
        key={match.index}
        documentId={match[3]?.trim()}
        file={match[1]!.trim()}
        page={parseInt(match[2]!, 10)}
        section={match[4]?.trim()}
      />,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : [text];
}

export const MarkdownText = memo(
  ({ content, isAssistant = false }: { content: string; isAssistant?: boolean }) => (
    <div className="prose prose-sm dark:prose-invert max-w-none [&_h1]:text-5xl [&_h2]:text-3xl dark:[&_p]:text-foreground/70 dark:[&_li]:text-foreground/70 dark:[&_strong]:text-foreground dark:[&_em]:text-foreground/70 dark:[&_h1]:text-foreground dark:[&_h1]:text-5xl dark:[&_h2]:text-foreground dark:[&_h2]:text-3xl dark:[&_h2]:font-normal dark:[&_h3]:text-foreground dark:[&_h3]:font-normal dark:[&_h4]:text-foreground [&_p]:whitespace-pre-wrap [&_ul]:list-none [&_ul]:pl-0 [&_ul>li]:pl-5 [&_ul>li]:my-0.5 [&_ul>li]:indent-[-1em] [&_ul>li]:before:content-['•'] [&_ul>li]:before:mr-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol>li]:my-0.5 [&_ol>li]:pl-1.5 [&_ol>li]:indent-[-0.25em]">
      <Streamdown
        components={{
          ...(isAssistant && {
            p: ({ children }: any) => {
              const text = typeof children === "string" ? children : null;
              return <p>{text ? renderWithCitations(text) : children}</p>;
            },
          }),
          code: ({ inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || "");
            const codeContent = String(children).replace(/\n$/, "");
            if (!inline && match) {
              return <CodeBlock code={codeContent} language={match[1] as any} />;
            }
            return (
              <code className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }: any) => <>{children}</>,
        }}
      >
        {content}
      </Streamdown>
    </div>
  ),
);

MarkdownText.displayName = "MarkdownText";
