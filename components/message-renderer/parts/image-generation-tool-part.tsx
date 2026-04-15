'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Loader2, ExternalLink, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

export function ImageGenerationToolPart({
  partKey,
  output,
}: ImageGenerationToolPartProps) {
  const { state, startPoll } = useGenerationPoll();
  const [resolvedImageUrl, setResolvedImageUrl] = useState(output.imageUrl);
  const [elapsedMs, setElapsedMs] = useState(0);

  const startedAtMs = useMemo(() => {
    if (!output.startedAt) return Date.now();
    const parsed = Date.parse(output.startedAt);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }, [output.startedAt]);

  useEffect(() => {
    if (output.imageUrl) {
      setResolvedImageUrl(output.imageUrl);
      return;
    }

    if (state.status === 'idle' && output.taskId && output.generationId) {
      void startPoll({ taskId: output.taskId, generationId: output.generationId });
    }
  }, [output.generationId, output.imageUrl, output.taskId, startPoll, state.status]);

  useEffect(() => {
    if (state.status === 'success' && state.output) {
      setResolvedImageUrl(state.output);
    }
  }, [state.output, state.status]);

  useEffect(() => {
    if (resolvedImageUrl || state.status === 'failed' || state.status === 'timeout') {
      return;
    }

    const updateElapsed = () => setElapsedMs(Date.now() - startedAtMs);
    updateElapsed();

    const intervalId = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(intervalId);
  }, [resolvedImageUrl, startedAtMs, state.status]);

  const isWaiting = !resolvedImageUrl && (state.status === 'idle' || state.status === 'polling');
  const errorText = state.status === 'failed' || state.status === 'timeout'
    ? (state.error ?? 'Image generation failed.')
    : null;

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

      {resolvedImageUrl && (
        <div className="space-y-3 rounded-2xl border bg-muted/20 p-3">
          <div className="overflow-hidden rounded-xl border bg-background">
            <Image
              src={resolvedImageUrl}
              alt="Generated image"
              width={1536}
              height={1024}
              unoptimized
              className="h-auto max-h-[520px] w-full object-contain"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="size-4" />
              Image ready
            </div>
            <div className="flex-1" />
            <Button asChild size="icon" variant="ghost" className="rounded-full">
              <a href={resolvedImageUrl} download="generated-image" aria-label="Download image">
                <Download className="size-4" />
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={resolvedImageUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" />
                Open
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={resolvedImageUrl} download="generated-image">
                <Download className="size-3.5" />
                Download
              </a>
            </Button>
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
