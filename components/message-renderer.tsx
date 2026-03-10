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
import { ShareIcon, CopyIcon, DownloadIcon } from 'lucide-react';
import type { MediaAsset } from '@/features/gallery/types';

export type MessagePartRendererProps = {
  part: UIMessagePart<any, any>;
  messageId: string;
  threadId?: string;
  index: number;
  onImageClick?: (asset: MediaAsset) => void;
};

type FilePart = {
  type: 'file';
  mediaType: string;
  url: string;
  filename?: string;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  assetId?: string;
  parentAssetId?: string;
  rootAssetId?: string;
  version?: number;
  editPrompt?: string;
};

const isFilePart = (part: UIMessagePart<any, any>): part is FilePart => {
  if (part.type !== 'file') {
    return false;
  }
  const record = part as Record<string, unknown>;
  return typeof record.mediaType === 'string' && typeof record.url === 'string';
};

export const MessagePartRenderer = memo(
  ({ part, messageId, threadId, index, onImageClick }: MessagePartRendererProps) => {
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
        const filePart = part as FilePart;
        const isDataUrl = part.url.startsWith('data:');
        const hasDimensions = typeof part.width === 'number' && typeof part.height === 'number';
        const previewUrl = !isDataUrl && part.thumbnailUrl ? part.thumbnailUrl : part.url;
        const canEdit = Boolean(onImageClick && !isDataUrl);

        const handleEditClick = async () => {
          if (!onImageClick) return;

          // If assetId is already in the part, use it directly
          if (filePart.assetId) {
            onImageClick({
              id: filePart.assetId,
              type: 'image',
              url: filePart.url,
              thumbnailUrl: filePart.thumbnailUrl ?? null,
              width: filePart.width ?? null,
              height: filePart.height ?? null,
              mimeType: filePart.mediaType,
              threadId: threadId ?? '',
              messageId,
              parentAssetId: filePart.parentAssetId ?? null,
              rootAssetId: filePart.rootAssetId ?? filePart.assetId,
              version: filePart.version ?? 1,
              editPrompt: filePart.editPrompt ?? null,
              createdAtMs: Date.now(),
            });
            return;
          }

          // Fallback: look up asset by messageId from the API
          if (messageId) {
            try {
              const res = await fetch(`/api/media-assets?messageId=${encodeURIComponent(messageId)}`);
              if (res.ok) {
                const data = await res.json() as { assets: MediaAsset[] };
                const match = data.assets.find((a) => a.url === filePart.url || a.thumbnailUrl === filePart.thumbnailUrl);
                if (match) { onImageClick(match); return; }
              }
            } catch { /* fall through */ }
          }
        };

        const imgElement = hasDimensions && !isDataUrl ? (
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
        );

        const handleShare = async (e: React.MouseEvent) => {
          e.stopPropagation();
          try {
            await navigator.share({ url: part.url });
          } catch {
            await navigator.clipboard.writeText(part.url);
          }
        };

        const handleCopy = async (e: React.MouseEvent) => {
          e.stopPropagation();
          try {
            const res = await fetch(part.url);
            const blob = await res.blob();
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
          } catch {
            await navigator.clipboard.writeText(part.url);
          }
        };

        return (
          <div
            key={key}
            className={`group/img relative overflow-hidden rounded-lg border bg-muted/50 p-2 ${canEdit ? 'cursor-pointer' : ''}`}
            onClick={canEdit ? handleEditClick : undefined}
          >
            {imgElement}
            {/* Button group — visible on hover */}
            <div
              className="absolute bottom-3 right-3 flex items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover/img:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  type="button"
                  title="Share"
                  onClick={handleShare}
                  className="flex size-8 items-center justify-center rounded-full bg-background/90 shadow hover:bg-background transition-colors"
                >
                  <ShareIcon className="size-3.5 text-foreground" />
                </button>
              )}
              <button
                type="button"
                title="Copy image"
                onClick={handleCopy}
                className="flex size-8 items-center justify-center rounded-full bg-background/90 shadow hover:bg-background transition-colors"
              >
                <CopyIcon className="size-3.5 text-foreground" />
              </button>
              <a
                href={part.url}
                download={part.filename ?? 'image.webp'}
                title="Download"
                className="flex size-8 items-center justify-center rounded-full bg-background/90 shadow hover:bg-background transition-colors"
              >
                <DownloadIcon className="size-3.5 text-foreground" />
              </a>
            </div>
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
    <div className="prose prose-sm dark:prose-invert max-w-none dark:[&_p]:text-zinc-300 dark:[&_li]:text-zinc-300 dark:[&_strong]:text-zinc-200 dark:[&_em]:text-zinc-300 dark:[&_h1]:text-sky-400 dark:[&_h1]:text-5xl dark:[&_h2]:text-sky-400 dark:[&_h2]:text-3xl dark:[&_h3]:text-sky-400 dark:[&_h3]:font-normal dark:[&_h4]:text-sky-400 [&_p]:whitespace-pre-wrap [&_ul]:list-none [&_ul]:pl-0 [&_ul>li]:pl-5 [&_ul>li]:my-0.5 [&_ul>li]:indent-[-1em] [&_ul>li]:before:content-['•'] [&_ul>li]:before:mr-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol>li]:my-0.5 [&_ol>li]:pl-1.5 [&_ol>li]:indent-[-0.25em] ">
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

