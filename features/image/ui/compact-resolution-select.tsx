'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RESOLUTION_TIMES } from '../constants';

interface Props {
  value: '1K' | '2K' | '4K';
  onChange: (v: '1K' | '2K' | '4K') => void;
}

export function CompactResolutionSelect({ value, onChange }: Props) {
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
        <span className="inline-block w-3.5 h-3 rounded-[2px] border border-current opacity-70" />
        <span>{value}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute bottom-full mb-1.5 left-0 z-50 w-32 rounded-lg border bg-popover shadow-lg py-1">
          {(['1K', '2K', '4K'] as const).map(r => (
            <button
              key={r}
              onClick={() => { onChange(r); setOpen(false); }}
              className={cn(
                'w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-muted transition-colors',
                value === r ? 'text-primary font-medium' : 'text-foreground',
              )}
            >
              <span>{r}</span>
              <span className="text-muted-foreground">{RESOLUTION_TIMES[r]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
