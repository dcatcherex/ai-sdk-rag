import Image from 'next/image';
import { DownloadIcon, ImageIcon, LayersIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '../utils';
import type { MediaAsset } from '../types';

type Props = {
  asset: MediaAsset;
  versionCount?: number;
  onEdit: (asset: MediaAsset) => void;
};

export const GalleryCard = ({ asset, versionCount = 1, onEdit }: Props) => {
  const preview = asset.thumbnailUrl ?? asset.url;

  return (
    <div
      className="group relative aspect-square overflow-hidden rounded-lg border border-black/5 dark:border-border shadow-[0_20px_40px_-30px_rgba(15,23,42,0.45)] dark:shadow-[0_20px_40px_-30px_rgba(0,0,0,0.6)] cursor-pointer"
      onClick={() => onEdit(asset)}
    >
      {versionCount > 1 && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
          <LayersIcon className="size-2.5" />
          {versionCount}
        </div>
      )}
      <Image
        src={preview}
        alt="Generated asset"
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
        className="object-cover transition duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="flex items-end justify-between gap-2 px-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">Generated image</p>
            <p className="text-[10px] text-white/70">
              {asset.width && asset.height ? `${asset.width}×${asset.height}` : asset.mimeType}
              {' • '}
              {formatRelativeTime(asset.createdAtMs)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button variant="secondary" size="icon-sm" asChild onClick={(e) => e.stopPropagation()}>
              <a href={asset.url} target="_blank" rel="noreferrer">
                <ImageIcon className="size-3" />
              </a>
            </Button>
            <Button variant="outline" size="icon-sm" asChild onClick={(e) => e.stopPropagation()}>
              <a href={asset.url} download>
                <DownloadIcon className="size-3" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
