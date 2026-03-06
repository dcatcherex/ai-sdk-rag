import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ImageIcon } from 'lucide-react';
import { GalleryCard } from './gallery-card';
import type { MediaAsset } from '../types';

type Props = {
  assets: MediaAsset[];
  isLoading: boolean;
  error: Error | null;
  filter: 'all' | 'image';
  onFilterChange: (filter: 'all' | 'image') => void;
  onEdit: (asset: MediaAsset) => void;
};

const GRID_CLASS = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4 md:gap-2';

export const GalleryGrid = ({ assets, isLoading, error, filter, onFilterChange, onEdit }: Props) => {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Media Library
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
            Your generated gallery
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Browse every image you have created, optimized with WebP thumbnails.
          </p>
        </div>
      </header>

      <section className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant={filter === 'image' ? 'default' : 'outline'}
          onClick={() => onFilterChange('image')}
        >
          <ImageIcon className="size-4" />
          Images
        </Button>
        <Button
          size="sm"
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => onFilterChange('all')}
        >
          All media
        </Button>
        <Badge variant="secondary" className="ml-auto">
          {assets.length} items
        </Badge>
      </section>

      <div className="mt-5">
        {isLoading ? (
          <div className={GRID_CLASS}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Card
                key={`skeleton-${i}`}
                className="aspect-square animate-pulse rounded-lg border border-black/5 dark:border-white/10 bg-white/70 dark:bg-zinc-800/70"
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
          <div className={GRID_CLASS}>
            {assets.map((asset) => (
              <GalleryCard key={asset.id} asset={asset} onEdit={onEdit} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
