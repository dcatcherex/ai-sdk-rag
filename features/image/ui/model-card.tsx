'use client';

import { cn } from '@/lib/utils';
import type { ImageModelConfig } from '../types';

interface Props {
  config: ImageModelConfig;
  selected: boolean;
  onClick: () => void;
}

export function ModelCard({ config, selected, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-lg border p-3 text-left transition-all',
        selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-foreground/30',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-tight">{config.name}</span>
        {config.badge && (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{config.badge}</span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{config.description}</p>
      <p className="mt-1.5 text-xs font-medium text-foreground/60">{config.creditCost} credits</p>
    </button>
  );
}
