'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Download, Loader2, ExternalLink, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useGenerationPoll } from '@/lib/hooks/use-generation-poll';
import { cn } from '@/lib/utils';
import type { ImageGenerationToolOutput } from '@/components/message-renderer/types';

type ImageGenerationToolPartProps = {
  partKey: string;
  output: ImageGenerationToolOutput;
};

function formatElapsed(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

function triggerBrowserDownload(url: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function ImageGenerationToolPart({
  partKey,
  output,
}: ImageGenerationToolPartProps) {
  const { state, startPoll } = useGenerationPoll();
  const [resolvedImageUrls, setResolvedImageUrls] = useState<string[]>(
    output.imageUrls?.length ? output.imageUrls : output.imageUrl ? [output.imageUrl] : [],
  );
  const [elapsedMs, setElapsedMs] = useState(0);

  const startedAtMs = useMemo(() => {
    if (!output.startedAt) return Date.now();
    const parsed = Date.parse(output.startedAt);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }, [output.startedAt]);

  useEffect(() => {
    if (output.imageUrls?.length || output.imageUrl) {
      setResolvedImageUrls(output.imageUrls?.length ? output.imageUrls : output.imageUrl ? [output.imageUrl] : []);
      return;
    }

    if (state.status === 'idle' && output.taskId && output.generationId) {
      void startPoll({ taskId: output.taskId, generationId: output.generationId });
    }
  }, [output.generationId, output.imageUrl, output.taskId, startPoll, state.status]);

  useEffect(() => {
    if (state.status === 'success' && (state.outputs?.length || state.output)) {
      setResolvedImageUrls(state.outputs?.length ? state.outputs : state.output ? [state.output] : []);
    }
  }, [state.output, state.outputs, state.status]);

  useEffect(() => {
    if (resolvedImageUrls.length > 0 || state.status === 'failed' || state.status === 'timeout') {
      return;
    }

    const updateElapsed = () => setElapsedMs(Date.now() - startedAtMs);
    updateElapsed();

    const intervalId = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(intervalId);
  }, [resolvedImageUrls, startedAtMs, state.status]);

  const isWaiting = resolvedImageUrls.length === 0 && (state.status === 'idle' || state.status === 'polling');
  const errorText = state.status === 'failed' || state.status === 'timeout'
    ? (state.error ?? 'Image generation failed.')
    : null;

  const handleDownloadAll = () => {
    resolvedImageUrls.forEach((imageUrl, index) => {
      window.setTimeout(() => {
        triggerBrowserDownload(imageUrl, `generated-image-${index + 1}`);
      }, index * 150);
    });
  };

  return (
    <div key={partKey} className="not-prose mb-4 w-full">
      {isWaiting && (
        <div className="rounded-2xl border bg-muted/20 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            Creating image
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Please wait a moment. Elapsed time: {formatElapsed(elapsedMs)}
          </p>
        </div>
      )}

      {resolvedImageUrls.length > 0 && (
        <div className="space-y-3 rounded-2xl border bg-muted/20 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {resolvedImageUrls.map((imageUrl, index) => (
              <div key={`${imageUrl}-${index}`} className="group relative overflow-hidden rounded-xl border bg-background">
                <Image
                  src={imageUrl}
                  alt={`Generated image ${index + 1}`}
                  width={1536}
                  height={1024}
                  unoptimized
                  className="h-auto max-h-[520px] w-full object-contain"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="absolute right-3 bottom-3 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button asChild size="icon" variant="secondary" className="pointer-events-auto rounded-full shadow-sm">
                    <a href={imageUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open image ${index + 1}`}>
                      <ExternalLink className="size-4" />
                    </a>
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="pointer-events-auto rounded-full shadow-sm"
                    onClick={() => triggerBrowserDownload(imageUrl, `generated-image-${index + 1}`)}
                    aria-label={`Download image ${index + 1}`}
                  >
                    <Download className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="size-4" />
              {resolvedImageUrls.length === 1 ? 'Image ready' : `${resolvedImageUrls.length} images ready`}
            </div>
            <div className="flex-1" />
            <Button asChild size="sm" variant="outline">
              <a href={resolvedImageUrls[0]} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" />
                Open
              </a>
            </Button>
            {resolvedImageUrls.length === 1 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => triggerBrowserDownload(resolvedImageUrls[0]!, 'generated-image-1')}
              >
                <Download className="size-3.5" />
                Download
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Download className="size-3.5" />
                    Download
                    <ChevronDown className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={handleDownloadAll}>
                    Download all images
                  </DropdownMenuItem>
                  {resolvedImageUrls.map((imageUrl, index) => (
                    <DropdownMenuItem
                      key={`${imageUrl}-download-${index}`}
                      onClick={() => triggerBrowserDownload(imageUrl, `generated-image-${index + 1}`)}
                    >
                      Download image {index + 1}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}

      {errorText && (
        <div
          className={cn(
            'rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'
          )}
        >
          <div className="flex items-center gap-2 font-medium">
            <XCircle className="size-4" />
            Generation failed
          </div>
          <p className="mt-2">{errorText}</p>
        </div>
      )}
    </div>
  );
}
