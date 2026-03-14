'use client';

import { CheckIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import type { Brand } from '../types';
import { useBrandAssets } from '../hooks/use-brands';

type Props = {
  brand: Brand;
  isSelected: boolean;
  confirmDelete: boolean;
  isDeleting: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRequestDelete: () => void;
};

export function BrandCard({
  brand,
  isSelected,
  confirmDelete,
  isDeleting,
  onSelect,
  onEdit,
  onDelete,
  onRequestDelete,
}: Props) {
  const { data: assets = [] } = useBrandAssets(brand.id);
  const logoAsset = assets.find((a) => a.kind === 'logo');

  const initials = brand.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      className={`group relative w-28 cursor-pointer overflow-hidden rounded-xl border transition-all ${
        isSelected
          ? 'border-primary/30 ring-2 ring-primary/20'
          : 'border-black/8 dark:border-border hover:border-black/15 dark:hover:border-white/20'
      }`}
    >
      {/* Color block + logo or initials */}
      <div
        className="flex h-20 items-center justify-center bg-muted"
        // style={{ background: brand.colors[3]?.hex ?? 'hsl(var(--muted))' }}
      >
        {logoAsset ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoAsset.url}
            alt={brand.name}
            className="max-h-14 max-w-[80%] object-contain drop-shadow"
          />
        ) : (
          <span className="select-none text-2xl font-bold text-white/80 drop-shadow">
            {initials}
          </span>
        )}
      </div>

      {/* Name */}
      <div className="px-2.5 pb-2.5 pt-2">
        <p className="truncate text-xs font-medium leading-tight">{brand.name}</p>
        {brand.isDefault && (
          <p className="mt-0.5 text-[10px] text-primary">Default</p>
        )}
      </div>

      {/* Hover: edit + delete overlay */}
      <div className="absolute right-1 top-1 hidden items-center gap-0.5 group-hover:flex">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="rounded bg-black/30 p-1 text-white transition-colors hover:bg-black/50"
          aria-label="Edit brand"
        >
          <PencilIcon className="size-3" />
        </button>
        {confirmDelete ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            disabled={isDeleting}
            className="rounded bg-destructive/80 p-1 text-white transition-colors hover:bg-destructive"
            aria-label="Confirm delete"
          >
            <CheckIcon className="size-3" />
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRequestDelete(); }}
            className="rounded bg-black/30 p-1 text-white transition-colors hover:bg-destructive/80"
            aria-label="Delete brand"
          >
            <Trash2Icon className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}
