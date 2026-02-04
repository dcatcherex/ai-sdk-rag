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

export type MessagePartRendererProps = {
  part: UIMessagePart<any, any>;
  messageId: string;
  index: number;
};

export const MessagePartRenderer = memo(
  ({ part, messageId, index }: MessagePartRendererProps) => {
    const key = `${messageId}-${index}`;

    // Text content with markdown support
    if (part.type === 'text') {
      return <MarkdownText key={key} content={part.text} />;
    }

    // Tool call rendering
    if (part.type.startsWith('tool-') && 'state' in part && 'input' in part) {
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

    // Fallback for unknown part types
    return (
      <pre
        key={key}
        className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground"
      >
        {JSON.stringify(part, null, 2)}
      </pre>
    );
  }
);

MessagePartRenderer.displayName = 'MessagePartRenderer';

// Markdown text renderer with code block support
const MarkdownText = memo(({ content }: { content: string }) => {
  const parts = parseMarkdownWithCode(content);

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'code') {
          return (
            <CodeBlock
              key={index}
              code={part.content}
              language={(part.language || 'plaintext') as any}
            />
          );
        }
        return (
          <div
            key={index}
            className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap"
          >
            {part.content}
          </div>
        );
      })}
    </>
  );
});

MarkdownText.displayName = 'MarkdownText';

// Simple markdown parser that extracts code blocks
function parseMarkdownWithCode(text: string) {
  const parts: Array<{
    type: 'text' | 'code';
    content: string;
    language?: string;
  }> = [];

  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    // Add code block
    parts.push({
      type: 'code',
      content: match[2] || '',
      language: match[1] || 'plaintext',
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return parts.length > 0 ? parts : [{ type: 'text' as const, content: text }];
}

// Utility to format file sizes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
}
