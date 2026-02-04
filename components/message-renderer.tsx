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
            className="prose prose-sm dark:prose-invert max-w-none [&>*]:whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: parseSimpleMarkdown(part.content) }}
          />
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

// Simple markdown to HTML converter for basic formatting
function parseSimpleMarkdown(text: string): string {
  let html = text;

  // Escape HTML to prevent XSS
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-sm">$1</code>');

  // Unordered lists
  html = html.replace(/^\* (.+)$/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/g, '<ul class="list-disc pl-6 space-y-1">$1</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gim, '<li>$1</li>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline">$1</a>');

  // Line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;

  return html;
}

// Utility to format file sizes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
}
