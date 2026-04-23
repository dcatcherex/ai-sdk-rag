'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, Download, Loader2, ExternalLink, Sparkles, XCircle } from 'lucide-react';
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
import type { ChatReferenceImage } from '@/features/chat/types';
import { useGenerationProgress } from '@/features/chat/context/generation-progress-context';

type Stage = { label: string; upTo: number; fromPct: number; toPct: number };

const STAGES: Stage[] = [
  { label: 'Analyzing prompt',     upTo: 20_000,  fromPct: 0,  toPct: 20 },
  { label: 'Generating image',     upTo: 60_000,  fromPct: 20, toPct: 55 },
  { label: 'Refining details',     upTo: 100_000, fromPct: 55, toPct: 80 },
  { label: 'Finishing up…',   upTo: Infinity, fromPct: 80, toPct: 92 },
];

function calcProgress(elapsedMs: number): { pct: number; label: string } {
  let elapsed = 0;
  for (const stage of STAGES) {
    const duration = stage.upTo === Infinity ? 80_000 : stage.upTo - elapsed;
    if (elapsedMs <= elapsed + duration || stage.upTo === Infinity) {
      const t = Math.min((elapsedMs - elapsed) / duration, 1);
      const pct = stage.fromPct + t * (stage.toPct - stage.fromPct);
      return { pct, label: stage.label };
    }
    elapsed = stage.upTo;
  }
  return { pct: 92, label: 'Finishing up…' };
}

type ImageGenerationToolPartProps = {
  partKey: string;
  output: ImageGenerationToolOutput;
  onUseImageInChat?: (image: ChatReferenceImage) => void;
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
  onUseImageInChat,
}: ImageGenerationToolPartProps) {
  const { state, startPoll } = useGenerationPoll();
  const upsertTask = useGenerationProgress()?.upsertTask;
  const [resolvedImageUrls, setResolvedImageUrls] = useState<string[]>(
    output.imageUrls?.length ? output.imageUrls : output.imageUrl ? [output.imageUrl] : [],
  );
  const [elapsedMs, setElapsedMs] = useState(0);
  const [loadedUrls, setLoadedUrls] = useState<Record<string, boolean>>({});
  const notifiedRef = useRef(false);
  const resolvedThumbnailUrls = output.thumbnailUrls?.length
    ? output.thumbnailUrls
    : output.thumbnailUrl
      ? [output.thumbnailUrl]
      : [];

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

  // Report poll status into the shared progress context (mini-bar)
  useEffect(() => {
    if (!upsertTask || !output.generationId) return;
    if (state.status === 'idle') return;
    upsertTask({
      generationId: output.generationId,
      toolName: 'generate_image',
      status: state.status === 'polling' ? 'polling'
        : state.status === 'success' ? 'success'
        : state.status === 'failed' ? 'failed'
        : state.status === 'timeout' ? 'timeout'
        : 'delayed',
      startedAt: output.startedAt,
    });
  }, [upsertTask, output.generationId, output.startedAt, state.status]);

  useEffect(() => {
    if (resolvedImageUrls.length > 0 || state.status === 'failed' || state.status === 'timeout') {
      return;
    }

    const updateElapsed = () => setElapsedMs(Date.now() - startedAtMs);
    updateElapsed();

    const intervalId = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(intervalId);
  }, [resolvedImageUrls, startedAtMs, state.status]);

  // Request notification permission as soon as we start polling
  useEffect(() => {
    if (state.status === 'polling' && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, [state.status]);

  // Fire browser notification when image arrives (only if tab is not visible)
  useEffect(() => {
    if (resolvedImageUrls.length === 0 || notifiedRef.current) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible') return;
    notifiedRef.current = true;
    const count = resolvedImageUrls.length;
    new Notification('Image ready', {
      body: count === 1 ? 'Your generated image is ready.' : `${count} generated images are ready.`,
      icon: '/favicon.ico',
    });
  }, [resolvedImageUrls]);

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

  const handleUseInChat = (imageUrl: string, index: number) => {
    if (!onUseImageInChat) return;

    onUseImageInChat({
      id: `${partKey}-${index}`,
      url: imageUrl,
      mediaType: 'image/png',
      filename: `generated-image-${index + 1}.png`,
      thumbnailUrl: resolvedThumbnailUrls[index],
    });
  };

  const stockImageUrls = output.stockImageUrls ?? [];
  const stockThumbnailUrls = output.stockThumbnailUrls ?? [];
  const hasStock = stockImageUrls.length > 0;

  return (
    <div key={partKey} className="not-prose mb-4 w-full space-y-3">
      {/* Stock images — shown immediately when available */}
      {hasStock && (
        <div className="space-y-3 rounded-2xl border bg-muted/20 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5" />
            From library
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {stockImageUrls.map((imageUrl, index) => (
              <div key={`stock-${imageUrl}-${index}`} className="group relative overflow-hidden rounded-xl border bg-background">
                {stockThumbnailUrls[index] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={stockThumbnailUrls[index]}
                    alt=""
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                      loadedUrls[imageUrl] ? "opacity-0" : "opacity-100",
                    )}
                  />
                ) : null}
                <Image
                  src={imageUrl}
                  alt={`Stock image ${index + 1}`}
                  width={1024}
                  height={1024}
                  unoptimized
                  className={cn(
                    "h-auto max-h-[400px] w-full object-contain transition-opacity duration-300",
                    loadedUrls[imageUrl] ? "opacity-100" : "opacity-0",
                  )}
                  onLoad={() => setLoadedUrls((c) => ({ ...c, [imageUrl]: true }))}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="absolute right-3 bottom-3 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button asChild size="icon" variant="secondary" className="pointer-events-auto rounded-full shadow-sm">
                    <a href={imageUrl} target="_blank" rel="noopener noreferrer" aria-label="Open stock image">
                      <ExternalLink className="size-4" />
                    </a>
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="pointer-events-auto rounded-full shadow-sm"
                    onClick={() => triggerBrowserDownload(imageUrl, `stock-image-${index + 1}`)}
                    aria-label="Download stock image"
                  >
                    <Download className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Personalizing progress pill — shown while custom image is in-flight when stock is visible */}
      {hasStock && isWaiting && (() => {
        const { pct, label } = calcProgress(elapsedMs);
        return (
          <div className="rounded-2xl border bg-muted/20 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Loader2 className="size-3.5 animate-spin text-primary" />
                Personalizing… {label.toLowerCase()}
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">{formatElapsed(elapsedMs)}</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-1000 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })()}

      {/* Full progress bar — shown only when no stock images (real-time only mode) */}
      {!hasStock && isWaiting && (() => {
        const { pct, label } = calcProgress(elapsedMs);
        return (
          <div className="rounded-2xl border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Loader2 className="size-4 animate-spin text-primary" />
                {label}
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">{formatElapsed(elapsedMs)}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-1000 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })()}

      {resolvedImageUrls.length > 0 && (
        <div className="space-y-3 rounded-2xl border bg-muted/20 p-3">
          {hasStock && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" />
              Personalized
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {resolvedImageUrls.map((imageUrl, index) => (
              <div key={`${imageUrl}-${index}`} className="group relative overflow-hidden rounded-xl border bg-background">
                {resolvedThumbnailUrls[index] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolvedThumbnailUrls[index]}
                    alt=""
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                      loadedUrls[imageUrl] ? "opacity-0" : "opacity-100",
                    )}
                  />
                ) : null}
                <Image
                  src={imageUrl}
                  alt={`Generated image ${index + 1}`}
                  width={1536}
                  height={1024}
                  unoptimized
                  className={cn(
                    "h-auto max-h-[520px] w-full object-contain transition-opacity duration-300",
                    loadedUrls[imageUrl] ? "opacity-100" : "opacity-0",
                  )}
                  onLoad={() => setLoadedUrls((current) => ({ ...current, [imageUrl]: true }))}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="absolute right-3 bottom-3 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  {onUseImageInChat ? (
                    <Button
                      size="icon"
                      variant="secondary"
                      className="pointer-events-auto rounded-full shadow-sm"
                      onClick={() => handleUseInChat(imageUrl, index)}
                      aria-label={`Use image ${index + 1} in next chat`}
                    >
                      <CheckCircle2 className="size-4" />
                    </Button>
                  ) : null}
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
            {onUseImageInChat && resolvedImageUrls.length === 1 ? (
              <Button size="sm" variant="outline" onClick={() => handleUseInChat(resolvedImageUrls[0]!, 0)}>
                <CheckCircle2 className="size-3.5" />
                Use in next chat
              </Button>
            ) : null}
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
