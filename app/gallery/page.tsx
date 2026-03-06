'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DownloadIcon, EraserIcon, ImageIcon, SparklesIcon } from 'lucide-react';

import { ChatSidebar } from '@/features/chat/components/chat-sidebar';
import { useThreads } from '@/features/chat/hooks/use-threads';
import { useUserProfile } from '@/features/chat/hooks/use-user-profile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const formatRelativeTime = (timestamp: number) => {
  const diffMs = Date.now() - timestamp;
  if (diffMs < 60 * 1000) return 'Just now';
  if (diffMs < 60 * 60 * 1000) return `${Math.floor(diffMs / (60 * 1000))}m ago`;
  if (diffMs < 24 * 60 * 60 * 1000) return `${Math.floor(diffMs / (60 * 60 * 1000))}h ago`;
  return `${Math.floor(diffMs / (24 * 60 * 60 * 1000))}d ago`;
};

type MediaAsset = {
  id: string;
  type: string;
  url: string;
  thumbnailUrl?: string | null;
  width?: number | null;
  height?: number | null;
  mimeType: string;
  threadId: string;
  messageId: string;
  parentAssetId?: string | null;
  rootAssetId?: string | null;
  version?: number | null;
  editPrompt?: string | null;
  createdAtMs: number;
};

const fetchMediaAssets = async (type: string, rootAssetId?: string) => {
  const params = new URLSearchParams();
  if (type !== 'all') {
    params.set('type', type);
  }
  if (rootAssetId) {
    params.set('rootAssetId', rootAssetId);
  }

  const url = params.size > 0 ? `/api/media-assets?${params.toString()}` : '/api/media-assets';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to load media assets');
  }
  const payload = (await response.json()) as { assets: MediaAsset[] };
  return payload.assets;
};

const getCanvasCoordinates = (canvas: HTMLCanvasElement, event: React.PointerEvent<HTMLCanvasElement>) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
};

export default function GalleryPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const {
    activeThreadId,
    setActiveThreadId,
    threads,
    isThreadsLoading,
    createThreadMutation,
    pinThreadMutation,
    renameThreadMutation,
    deleteThreadMutation,
    handleCreateThread,
  } = useThreads();

  const { sessionData, userProfile, isSigningOut, handleSignOut } = useUserProfile();

  const [filter, setFilter] = useState<'all' | 'image'>('image');
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [brushSize, setBrushSize] = useState(28);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 1024, height: 1024 });

  const queryClient = useQueryClient();
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['media-assets', filter],
    queryFn: () => fetchMediaAssets(filter),
  });

  const rootAssetId = selectedAsset?.rootAssetId ?? selectedAsset?.id;
  const { data: versionHistory = [] } = useQuery({
    queryKey: ['media-assets', 'history', rootAssetId],
    enabled: Boolean(editorOpen && rootAssetId),
    queryFn: async () => {
      if (!rootAssetId) {
        return [] as MediaAsset[];
      }
      const assets = await fetchMediaAssets('image', rootAssetId);
      return assets.sort((a, b) => (a.version ?? 1) - (b.version ?? 1));
    },
  });

  const assets = useMemo(() => data.filter((asset) => asset.type === 'image'), [data]);
  const selectedVersion = useMemo(() => {
    if (!selectedVersionId) {
      return selectedAsset;
    }
    return versionHistory.find((asset) => asset.id === selectedVersionId) ?? selectedAsset;
  }, [selectedAsset, selectedVersionId, versionHistory]);

  useEffect(() => {
    if (!selectedVersion) {
      return;
    }

    const width = selectedVersion.width ?? 1024;
    const height = selectedVersion.height ?? 1024;
    setCanvasDimensions({ width, height });

    const canvas = maskCanvasRef.current;
    if (!canvas) {
      return;
    }
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context?.clearRect(0, 0, width, height);
  }, [selectedVersion]);

  const openEditor = (asset: MediaAsset) => {
    setSelectedAsset(asset);
    setSelectedVersionId(asset.id);
    setEditPrompt('');
    setBrushSize(28);
    setSubmitError(null);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setSelectedAsset(null);
    setSelectedVersionId(null);
    setEditPrompt('');
    setSubmitError(null);
  };

  const clearMask = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext('2d');
    context?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const drawAtPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const { x, y } = getCanvasCoordinates(canvas, event);
    context.fillStyle = 'rgba(0, 0, 0, 1)';
    context.beginPath();
    context.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    context.fill();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    drawAtPoint(event);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) {
      return;
    }
    drawAtPoint(event);
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
  };

  const buildMaskDataUrl = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const hasMask = pixels.some((_, index) => index % 4 === 3 && pixels[index] > 0);
    if (!hasMask) {
      return undefined;
    }

    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    const outputContext = output.getContext('2d');
    if (!outputContext) {
      return undefined;
    }

    outputContext.fillStyle = '#ffffff';
    outputContext.fillRect(0, 0, output.width, output.height);
    outputContext.globalCompositeOperation = 'destination-out';
    outputContext.drawImage(canvas, 0, 0);
    return output.toDataURL('image/png');
  };

  const submitEdit = async () => {
    if (!selectedVersion || !selectedAsset) {
      return;
    }
    if (!editPrompt.trim()) {
      setSubmitError('Please describe the edit.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const maskDataUrl = buildMaskDataUrl();
      const response = await fetch('/api/images/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: selectedAsset.threadId,
          sourceAssetId: selectedVersion.id,
          prompt: editPrompt.trim(),
          maskDataUrl,
        }),
      });

      const payload = (await response.json()) as { error?: string; asset?: MediaAsset };
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to edit image');
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['media-assets'] }),
        queryClient.invalidateQueries({ queryKey: ['threads'] }),
        queryClient.invalidateQueries({ queryKey: ['threads', selectedAsset.threadId, 'messages'] }),
        queryClient.invalidateQueries({ queryKey: ['media-assets', 'history', rootAssetId] }),
      ]);

      setEditPrompt('');
      clearMask();

      if (payload.asset?.id) {
        setSelectedVersionId(payload.asset.id);
      }
    } catch (submitErrorValue) {
      const message = submitErrorValue instanceof Error ? submitErrorValue.message : 'Edit failed';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f7f7f9,#eef0f7_55%,#e6e9f2_100%)] dark:bg-[radial-gradient(circle_at_top,#1a1b2e,#111827_55%,#0f172a_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl gap-3 px-2 py-2 md:gap-6 md:px-4 md:py-6">
        <ChatSidebar
          activeThreadId={activeThreadId}
          threads={threads}
          isLoading={isThreadsLoading}
          isCreatingThread={createThreadMutation.isPending}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelectThread={(threadId) => {
            setActiveThreadId(threadId);
            router.push('/');
          }}
          onCreateThread={() => {
            handleCreateThread();
            router.push('/');
          }}
          onTogglePin={(threadId, pinned) => pinThreadMutation.mutate({ threadId, pinned })}
          onRenameThread={(threadId, title) => renameThreadMutation.mutate({ threadId, title })}
          onDeleteThread={(threadId) => deleteThreadMutation.mutate(threadId)}
          sessionData={sessionData}
          userProfile={userProfile}
          isSigningOut={isSigningOut}
          onSignOut={handleSignOut}
          mobileOpen={mobileSidebarOpen}
          onMobileOpenChange={setMobileSidebarOpen}
        />

        <main className="flex h-[calc(100dvh-1rem)] flex-1 flex-col overflow-hidden rounded-2xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 shadow-[0_35px_80px_-60px_rgba(15,23,42,0.5)] dark:shadow-[0_35px_80px_-60px_rgba(0,0,0,0.7)] backdrop-blur md:h-[calc(100vh-3rem)] md:rounded-3xl">
          <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Media Library
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">Your generated gallery</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Browse every image you have created, optimized with WebP thumbnails.
                </p>
              </div>
            </header>

            <section className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                variant={filter === 'image' ? 'default' : 'outline'}
                onClick={() => setFilter('image')}
              >
                <ImageIcon className="size-4" />
                Images
              </Button>
              <Button
                size="sm"
                variant={filter === 'all' ? 'default' : 'outline'}
                onClick={() => setFilter('all')}
              >
                All media
              </Button>
              <Badge variant="secondary" className="ml-auto">
                {assets.length} items
              </Badge>
            </section>

            <div className="mt-5">
              {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 md:gap-6">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Card
                      key={`skeleton-${index}`}
                      className="h-60 animate-pulse rounded-3xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-zinc-800/70"
                    />
                  ))}
                </div>
              ) : error ? (
                <Card className="rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-zinc-800/80 p-8 text-sm text-muted-foreground">
                  Unable to load media right now. Please refresh.
                </Card>
              ) : assets.length === 0 ? (
                <Card className="rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-zinc-800/80 p-8 text-sm text-muted-foreground">
                  No media yet. Generate an image in chat to see it here.
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 md:gap-6">
                  {assets.map((asset) => {
                    const preview = asset.thumbnailUrl ?? asset.url;
                    return (
                      <div
                        key={asset.id}
                        className="group relative overflow-hidden rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-zinc-800/80 shadow-[0_20px_40px_-30px_rgba(15,23,42,0.45)] dark:shadow-[0_20px_40px_-30px_rgba(0,0,0,0.6)]"
                      >
                        <div className="relative aspect-4/3 overflow-hidden">
                          <Image
                            src={preview}
                            alt="Generated asset"
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition duration-500 group-hover:scale-105"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-3 px-5 py-4">
                          <div>
                            <p className="text-sm font-semibold text-foreground">Generated image</p>
                            <p className="text-xs text-muted-foreground">
                              {asset.width && asset.height ? `${asset.width}×${asset.height}` : asset.mimeType}
                              {' • '}
                              {formatRelativeTime(asset.createdAtMs)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="secondary" size="icon-sm" onClick={() => openEditor(asset)}>
                              <SparklesIcon className="size-3" />
                            </Button>
                            <Button variant="secondary" size="icon-sm" asChild>
                              <a href={asset.url} target="_blank" rel="noreferrer">
                                <ImageIcon className="size-3" />
                              </a>
                            </Button>
                            <Button variant="outline" size="icon-sm" asChild>
                              <a href={asset.url} download>
                                <DownloadIcon className="size-3" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <Dialog open={editorOpen} onOpenChange={(open) => (open ? setEditorOpen(true) : closeEditor())}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Edit image version with AI SDK</DialogTitle>
            <DialogDescription>
              Paint a precise mask over areas to change. No painted mask means full-image edit.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
            <Card className="h-fit rounded-2xl border p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Versions
              </p>
              <div className="space-y-2">
                {versionHistory.map((versionAsset) => (
                  <button
                    key={versionAsset.id}
                    type="button"
                    onClick={() => setSelectedVersionId(versionAsset.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-2 py-2 text-left text-xs transition ${
                      selectedVersionId === versionAsset.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background hover:bg-muted/50'
                    }`}
                  >
                    <span className="font-medium">v{versionAsset.version ?? 1}</span>
                    <span className="text-muted-foreground">{formatRelativeTime(versionAsset.createdAtMs)}</span>
                  </button>
                ))}
              </div>
            </Card>

            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border bg-muted/20 p-2">
                {selectedVersion ? (
                  <div className="relative mx-auto w-full max-w-[720px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedVersion.url}
                      alt="Source version"
                      className="h-auto w-full rounded-xl"
                    />
                    <canvas
                      ref={maskCanvasRef}
                      width={canvasDimensions.width}
                      height={canvasDimensions.height}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerLeave={handlePointerUp}
                      className="absolute inset-0 h-full w-full cursor-crosshair rounded-xl"
                    />
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <Textarea
                  value={editPrompt}
                  onChange={(event) => setEditPrompt(event.target.value)}
                  placeholder="Describe your edit, e.g. replace background with watercolor sunset."
                  className="min-h-24"
                />
                <div className="space-y-3 rounded-xl border bg-muted/20 p-3 text-xs">
                  <label className="block space-y-1">
                    <span className="font-medium">Brush size: {brushSize}px</span>
                    <input
                      type="range"
                      min={8}
                      max={96}
                      step={2}
                      value={brushSize}
                      onChange={(event) => setBrushSize(Number(event.target.value))}
                      className="w-full"
                    />
                  </label>
                  <Button size="sm" variant="outline" onClick={clearMask} className="w-full">
                    <EraserIcon className="size-3.5" />
                    Clear mask
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

          <DialogFooter>
            <Button variant="outline" onClick={closeEditor}>Cancel</Button>
            <Button onClick={submitEdit} disabled={isSubmitting || !selectedVersion}>
              {isSubmitting ? 'Generating...' : 'Create next version'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
