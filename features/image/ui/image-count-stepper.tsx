'use client';

import { Minus, Plus } from 'lucide-react';

interface Props {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}

export function ImageCountStepper({ value, onChange, min = 1, max = 4 }: Props) {
  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground hover:border-foreground/40 hover:text-foreground disabled:opacity-40 transition-colors"
      >
        <Minus className="h-3 w-3" />
      </button>
      <span className="w-7 text-center text-sm font-medium tabular-nums">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground hover:border-foreground/40 hover:text-foreground disabled:opacity-40 transition-colors"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}
