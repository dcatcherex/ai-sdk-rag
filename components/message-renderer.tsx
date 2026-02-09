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
import Image from 'next/image';
import { Streamdown } from 'streamdown';

export type MessagePartRendererProps = {
  part: UIMessagePart<any, any>;
  messageId: string;
  index: number;
};

type FilePart = {
  type: 'file';
  mediaType: string;
  url: string;
  filename?: string;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
};

const isFilePart = (part: UIMessagePart<any, any>): part is FilePart => {
  if (part.type !== 'file') {
    return false;
  }
  const record = part as Record<string, unknown>;
  return typeof record.mediaType === 'string' && typeof record.url === 'string';
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
        <Tool key={key} >
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

    // File attachment preview (including image outputs from multimodal models)
    if (isFilePart(part)) {
      if (part.mediaType.startsWith('image/')) {
        const isDataUrl = part.url.startsWith('data:');
        const hasDimensions = typeof part.width === 'number' && typeof part.height === 'number';
        const previewUrl = !isDataUrl && part.thumbnailUrl ? part.thumbnailUrl : part.url;
        const showFullLink = previewUrl !== part.url;
        return (
          <div key={key} className="relative overflow-hidden rounded-lg border bg-muted/50 p-2">
            {showFullLink ? (
              <a href={part.url} target="_blank" rel="noreferrer">
                {hasDimensions && !isDataUrl ? (
                  <Image
                    src={previewUrl}
                    alt={part.filename ?? 'Generated image'}
                    width={part.width}
                    height={part.height}
                    sizes="(max-width: 768px) 100vw, 640px"
                    className="h-auto w-full rounded-md"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt={part.filename ?? 'Generated image'}
                    className="h-auto w-full rounded-md"
                  />
                )}
              </a>
            ) : hasDimensions && !isDataUrl ? (
              <Image
                src={previewUrl}
                alt={part.filename ?? 'Generated image'}
                width={part.width}
                height={part.height}
                sizes="(max-width: 768px) 100vw, 640px"
                className="h-auto w-full rounded-md"
              />
            ) : (
              <img
                src={previewUrl}
                alt={part.filename ?? 'Generated image'}
                className="h-auto w-full rounded-md"
              />
            )}
            <a
              href={part.url}
              download={part.filename ?? 'image.webp'}
              className="absolute bottom-2 right-2 inline-flex items-center rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow"
            >
              Download
            </a>
          </div>
        );
      }

      return (
        <a
          key={key}
          href={part.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-foreground hover:bg-muted"
        >
          <span className="font-medium">📎 {part.filename ?? 'Download file'}</span>
          <span className="text-muted-foreground text-xs">{part.mediaType}</span>
        </a>
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

