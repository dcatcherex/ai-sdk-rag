'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, ExternalLink, Loader2, Music, Video, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGenerationPoll } from '@/lib/hooks/use-generation-poll';
import { cn } from '@/lib/utils';
import type { MediaGenerationKind, MediaGenerationToolOutput } from '@/components/message-renderer/types';
import type { ChatReferenceImage } from '@/features/chat/types';
import { ImageGenerationToolPart } from './image-generation-tool-part';

type MediaGenerationToolPartProps = {
  partKey: string;
  kind: MediaGenerationKind;
  output: MediaGenerationToolOutput;
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

// ─── Video output card ────────────────────────────────────────────────────────

function VideoOutputCard({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  const url = urls[0]!;
  return (
    <div className="space-y-2 rounded-2xl border bg-muted/20 p-3">
      <video
        src={url}
        controls
        className="w-full rounded-xl"
        preload="metadata"
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="size-4" />
          Video ready
        </div>
        <div className="flex-1" />
        <Button asChild size="sm" variant="outline">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-3.5" />
            Open
          </a>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => triggerBrowserDownload(url, 'generated-video.mp4')}
        >
          <Download className="size-3.5" />
          Download
        </Button>
      </div>
    </div>
  );
}

// ─── Audio output card ────────────────────────────────────────────────────────

function AudioOutputCard({ urls, kind }: { urls: string[]; kind: 'audio' }) {
  if (urls.length === 0) return null;

  return (
    <div className="space-y-2 rounded-2xl border bg-muted/20 p-3">
      <div className="flex flex-col gap-2">
        {urls.map((url, index) => (
          <div key={`${url}-${index}`} className="rounded-xl border bg-background p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <Music className="size-4 text-primary" />
              {urls.length > 1 ? `Track ${index + 1}` : 'Generated audio'}
            </div>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={url} className="w-full" preload="metadata" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="size-4" />
          {urls.length === 1 ? 'Audio ready' : `${urls.length} tracks ready`}
        </div>
        <div className="flex-1" />
        {urls.length === 1 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => triggerBrowserDownload(urls[0]!, 'generated-audio')}
          >
            <Download className="size-3.5" />
            Download
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Pending card (shared for all kinds) ─────────────────────────────────────

function PendingCard({ kind, elapsedMs }: { kind: MediaGenerationKind; elapsedMs: number }) {
  const labels: Record<MediaGenerationKind, string> = {
    image: 'Creating image',
    video: 'Creating video',
    audio: 'Creating audio',
  };
  const icons: Record<MediaGenerationKind, React.ReactNode> = {
    image: <Loader2 className="size-4 animate-spin text-primary" />,
    video: <Video className="size-4 animate-pulse text-primary" />,
    audio: <Music className="size-4 animate-pulse text-primary" />,
  };
  return (
    <div className="rounded-2xl border bg-muted/20 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        {icons[kind]}
        {labels[kind]}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Please wait a moment. Elapsed time: {formatElapsed(elapsedMs)}
      </p>
    </div>
  );
}

// ─── Error card (shared) ──────────────────────────────────────────────────────

function ErrorCard({ errorText }: { errorText: string }) {
  return (
    <div className={cn('rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive')}>
      <div className="flex items-center gap-2 font-medium">
        <XCircle className="size-4" />
        Generation failed
      </div>
      <p className="mt-2">{errorText}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MediaGenerationToolPart({
  partKey,
  kind,
  output,
  onUseImageInChat,
}: MediaGenerationToolPartProps) {
  // Image kind: delegate fully to ImageGenerationToolPart which has richer image UX
  if (kind === 'image') {
    return (
      <ImageGenerationToolPart
        partKey={partKey}
        output={output}
        onUseImageInChat={onUseImageInChat}
      />
    );
  }

  // ── Video / Audio kinds ─────────────────────────────────────────────────────
  const { state, startPoll } = useGenerationPoll();

  const initialUrls = useMemo(
    () => (output.imageUrls?.length ? output.imageUrls : output.imageUrl ? [output.imageUrl] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [resolvedUrls, setResolvedUrls] = useState<string[]>(initialUrls);
  const [elapsedMs, setElapsedMs] = useState(0);

  const startedAtMs = useMemo(() => {
    if (!output.startedAt) return Date.now();
    const parsed = Date.parse(output.startedAt);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }, [output.startedAt]);

  useEffect(() => {
    if (output.imageUrls?.length || output.imageUrl) {
      setResolvedUrls(output.imageUrls?.length ? output.imageUrls : output.imageUrl ? [output.imageUrl] : []);
      return;
    }
    if (state.status === 'idle' && output.taskId && output.generationId) {
      void startPoll({ taskId: output.taskId, generationId: output.generationId });
    }
  }, [output.generationId, output.imageUrl, output.imageUrls, output.taskId, startPoll, state.status]);

  useEffect(() => {
    if (state.status === 'success' && (state.outputs?.length || state.output)) {
      setResolvedUrls(state.outputs?.length ? state.outputs : state.output ? [state.output] : []);
    }
  }, [state.output, state.outputs, state.status]);

  useEffect(() => {
    if (resolvedUrls.length > 0 || state.status === 'failed' || state.status === 'timeout') return;
    const update = () => setElapsedMs(Date.now() - startedAtMs);
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [resolvedUrls, startedAtMs, state.status]);

  const isWaiting = resolvedUrls.length === 0 && (state.status === 'idle' || state.status === 'polling');
  const errorText =
    state.status === 'failed' || state.status === 'timeout'
      ? (state.error ?? 'Generation failed.')
      : null;

  return (
    <div key={partKey} className="not-prose mb-4 w-full">
      {isWaiting && <PendingCard kind={kind} elapsedMs={elapsedMs} />}
      {resolvedUrls.length > 0 && kind === 'video' && <VideoOutputCard urls={resolvedUrls} />}
      {resolvedUrls.length > 0 && kind === 'audio' && <AudioOutputCard urls={resolvedUrls} kind={kind} />}
      {errorText && <ErrorCard errorText={errorText} />}
    </div>
  );
}
