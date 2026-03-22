'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ProviderIcon } from '../ui/provider-icon';
import type { BaseModelConfig } from '../types';

interface Props {
  models: BaseModelConfig[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function ModelSelector({ models, selectedId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = models.find(m => m.id === selectedId) ?? models[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="space-y-1.5 relative" ref={ref}>
      <Label>Model</Label>

      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors bg-secondary',
          open ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-foreground/30',
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selected && <ProviderIcon provider={selected.provider} />}
          <span className="font-medium truncate">{selected?.name}</span>
          {selected?.badge && (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {selected.badge}
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {/* Dropdown — floats over layout */}
      {open && (
        <div className="absolute left-0 right-0 z-50 rounded-lg border bg-popover shadow-lg overflow-hidden">
          {models.map(cfg => (
            <button
              key={cfg.id}
              onClick={() => { onSelect(cfg.id); setOpen(false); }}
              className={cn(
                'w-full flex  gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/60',
                cfg.id === selectedId ? 'bg-muted' : '',
              )}
            >
              <ProviderIcon provider={cfg.provider} className="size-4 my-1" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{cfg.name}</span>
                  {cfg.badge && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary leading-none">
                      {cfg.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{cfg.description}</p>
              </div>
              
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
