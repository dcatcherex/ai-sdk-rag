'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftIcon, DownloadIcon, ImageIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

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
  createdAtMs: number;
};

const fetchMediaAssets = async (type: string) => {
  const url = type === 'all' ? '/api/media-assets' : `/api/media-assets?type=${type}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to load media assets');
  }
  const payload = (await response.json()) as { assets: MediaAsset[] };
  return payload.assets;
};

export default function GalleryPage() {
  const [filter, setFilter] = useState<'all' | 'image'>('image');
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['media-assets', filter],
    queryFn: () => fetchMediaAssets(filter),
  });

  const assets = useMemo(() => data.filter((asset) => asset.type === 'image'), [data]);

  return (
    <div className="min-h-screen bg-[radial-gradient(80%_60%_at_20%_0%,#fff7e6_0%,#eef2ff_45%,#e2e8f0_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 md:gap-8 md:px-6 md:py-8">
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
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/">
                <ArrowLeftIcon className="size-4" />
                Back to chat
              </Link>
            </Button>
          </div>
        </header>

        <section className="flex flex-wrap items-center gap-3">
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

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 md:gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card
                key={`skeleton-${index}`}
                className="h-60 animate-pulse rounded-3xl border border-black/5 bg-white/70"
              />
            ))}
          </div>
        ) : error ? (
          <Card className="rounded-3xl border border-black/5 bg-white/80 p-8 text-sm text-muted-foreground">
            Unable to load media right now. Please refresh.
          </Card>
        ) : assets.length === 0 ? (
          <Card className="rounded-3xl border border-black/5 bg-white/80 p-8 text-sm text-muted-foreground">
            No media yet. Generate an image in chat to see it here.
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 md:gap-6">
            {assets.map((asset) => {
              const preview = asset.thumbnailUrl ?? asset.url;
              return (
                <div
                  key={asset.id}
                  className="group relative overflow-hidden rounded-3xl border border-black/5 bg-white/80 shadow-[0_20px_40px_-30px_rgba(15,23,42,0.45)]"
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
  );
}
