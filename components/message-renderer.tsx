'use client';

import { CodeBlock } from '@/components/ai-elements/code-block';
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool';
import type { UIMessagePart } from 'ai';
import { memo } from 'react';
import { Streamdown } from 'streamdown';

export type MessagePartRendererProps = {
  part: UIMessagePart<any, any>;
  messageId: string;
  index: number;
};

export const MessagePartRenderer = memo(
  ({ part, messageId, index }: MessagePartRendererProps) => {
    const key = `${messageId}-${index}`;

    // Safety check - if part is undefined or null, skip it
    if (!part || typeof part !== 'object') {
      return null;
    }

    // Text content with markdown support
    if (part.type === 'text') {
      return <MarkdownText key={key} content={part.text} />;
    }

    // Tool call rendering
    if (typeof part.type === 'string' && part.type.startsWith('tool-') && 'state' in part && 'input' in part) {
      const toolPart = part as any;
      return (
        <Tool key={key} defaultOpen>
          <ToolHeader
            type={toolPart.type}
            state={toolPart.state}
            toolName={toolPart.toolName || toolPart.type}
          />
          <ToolContent>
            <ToolInput input={toolPart.input} />
            {toolPart.output && (
              <ToolOutput output={toolPart.output} errorText={toolPart.errorText} />
            )}
          </ToolContent>
        </Tool>
      );
    }

    // File attachment preview
    if (part.type === 'file' && 'file' in part) {
      const filePart = part as any;
      return (
        <div
          key={key}
          className="rounded-lg border bg-muted/50 p-3 text-sm"
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">📎 {filePart.file?.name ?? 'Attachment'}</span>
            {filePart.file?.size && (
              <span className="text-muted-foreground text-xs">
                ({formatBytes(filePart.file.size)})
              </span>
            )}
          </div>
        </div>
      );
    }

    // Step-start and other control types should be ignored (don't render anything)
    const partType = part.type as string;
    if (partType === 'step-start' || partType === 'step-finish' || partType === 'step-result') {
      return null;
    }

    // For debugging: only show JSON for truly unknown types
    // This helps identify what's not being handled correctly
    console.warn('Unknown message part type:', part.type, part);

    return null; // Don't render unknown types instead of showing raw JSON
  }
);

MessagePartRenderer.displayName = 'MessagePartRenderer';

// Markdown text renderer with proper markdown support using streamdown
const MarkdownText = memo(({ content }: { content: string }) => {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:whitespace-pre-wrap">
      <Streamdown
        components={{
          code: ({ inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const codeContent = String(children).replace(/\n$/, '');

            if (!inline && match) {
              return (
                <CodeBlock
                  code={codeContent}
                  language={match[1] as any}
                />
              );
            }

            return (
              <code
                className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }: any) => {
            // Return just the code element, CodeBlock handles the pre wrapper
            return <>{children}</>;
          },
        }}
      >
        {content}
      </Streamdown>
    </div>
  );
});

MarkdownText.displayName = 'MarkdownText';

// Utility to format file sizes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
}
