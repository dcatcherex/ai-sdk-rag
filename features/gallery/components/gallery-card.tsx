import Image from 'next/image';
import { DownloadIcon, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '../utils';
import type { MediaAsset } from '../types';

type Props = {
  asset: MediaAsset;
  onEdit: (asset: MediaAsset) => void;
};

export const GalleryCard = ({ asset, onEdit }: Props) => {
  const preview = asset.thumbnailUrl ?? asset.url;

  return (
    <div
      className="group relative aspect-square overflow-hidden rounded-lg border border-black/5 dark:border-white/10 shadow-[0_20px_40px_-30px_rgba(15,23,42,0.45)] dark:shadow-[0_20px_40px_-30px_rgba(0,0,0,0.6)] cursor-pointer"
      onClick={() => onEdit(asset)}
    >
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
