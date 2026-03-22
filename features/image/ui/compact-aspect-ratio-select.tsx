'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RATIO_LABELS } from '../constants';
import { RatioIcon } from './ratio-icon';

interface Props {
  ratios: string[];
  value: string;
  onChange: (v: string) => void;
}

export function CompactAspectRatioSelect({ ratios, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-foreground/40',
          open ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground',
        )}
      >
        <RatioIcon ratio={value} size={14} />
        <span>{value}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute bottom-full mb-1.5 left-0 z-50 w-44 rounded-lg border bg-popover shadow-lg py-1">
          {ratios.map(r => (
            <button
              key={r}
              onClick={() => { onChange(r); setOpen(false); }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-muted transition-colors text-left',
                value === r ? 'text-primary font-medium' : 'text-foreground',
              )}
            >
              <RatioIcon ratio={r} size={14} />
              <span className="flex-1">{r}</span>
              {RATIO_LABELS[r] && <span className="text-muted-foreground">{RATIO_LABELS[r]}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
