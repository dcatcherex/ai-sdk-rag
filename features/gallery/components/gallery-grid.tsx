import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ImageIcon } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { GalleryCard } from './gallery-card';
import type { AssetGroup } from '../hooks/use-gallery-assets';
import type { MediaAsset } from '../types';

type Props = {
  assetGroups: AssetGroup[];
  activeVersions: Record<string, string>;
  isLoading: boolean;
  error: Error | null;
  filter: 'all' | 'image';
  onFilterChange: (filter: 'all' | 'image') => void;
  onEdit: (asset: MediaAsset) => void;
};

const GRID_CLASS = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4 md:gap-2';

export const GalleryGrid = ({ assetGroups, activeVersions, isLoading, error, filter, onFilterChange, onEdit }: Props) => {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <PageHeader
        title="Media Library"
        description="Browse every image you have created, optimized with WebP thumbnails."
      />

      <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
      <section className="flex flex-wrap items-center gap-3">
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
          {assetGroups.length} items
        </Badge>
      </section>

      <div className="mt-5">
        {isLoading ? (
          <div className={GRID_CLASS}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Card
                key={`skeleton-${i}`}
                className="aspect-square animate-pulse rounded-lg border border-black/5 dark:border-border bg-white/70 dark:bg-muted/70"
              />
            ))}
          </div>
        ) : error ? (
          <Card className="rounded-3xl border border-black/5 dark:border-border bg-white/80 dark:bg-muted/80 p-8 text-sm text-muted-foreground">
            Unable to load media right now. Please refresh.
          </Card>
        ) : assetGroups.length === 0 ? (
          <Card className="rounded-3xl border border-black/5 dark:border-border bg-white/80 dark:bg-muted/80 p-8 text-sm text-muted-foreground">
            No media yet. Generate an image in chat to see it here.
          </Card>
        ) : (
          <div className={GRID_CLASS}>
            {assetGroups.map(({ rootId, versions, count }) => {
              const activeId = activeVersions[rootId];
              const activeAsset = activeId
                ? (versions.find((v) => v.id === activeId) ?? versions[versions.length - 1])
                : versions[versions.length - 1];
              return (
                <GalleryCard
                  key={rootId}
                  asset={activeAsset}
                  versionCount={count}
                  onEdit={onEdit}
                />
              );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};
