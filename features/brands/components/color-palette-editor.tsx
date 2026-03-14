'use client';

import { GripVerticalIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SUGGESTED_COLOR_LABELS, type BrandColor } from '../types';

type Props = {
  colors: BrandColor[];
  onChange: (v: BrandColor[]) => void;
};

export function ColorPaletteEditor({ colors, onChange }: Props) {
  const update = (i: number, patch: Partial<BrandColor>) => {
    onChange(colors.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };
  const remove = (i: number) => onChange(colors.filter((_, idx) => idx !== i));
  const add = () => {
    const label = SUGGESTED_COLOR_LABELS[colors.length] ?? 'Custom';
    onChange([...colors, { hex: '#6366f1', label }]);
  };
  const addSuggested = () => {
    const existing = new Set(colors.map((c) => c.label));
    const toAdd = SUGGESTED_COLOR_LABELS.filter((l) => !existing.has(l)).map((label) => ({
      hex: '#6366f1',
      label,
    }));
    onChange([...colors, ...toAdd]);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label>Brand Colors</Label>
        <div className="flex gap-1">
          {colors.length === 0 && (
            <button
              type="button"
              onClick={addSuggested}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5"
            >
              Add suggested 5
            </button>
          )}
          <button
            type="button"
            onClick={add}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-black/5 dark:hover:bg-white/8 hover:text-foreground transition-colors"
          >
            <PlusIcon className="size-3" />
            Add color
          </button>
        </div>
      </div>

      {colors.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">
          No colors yet. Click &quot;Add suggested 5&quot; for the standard palette.
        </p>
      ) : (
        <div className="space-y-2">
          {colors.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <GripVerticalIcon className="size-3.5 shrink-0 text-muted-foreground/30" />
              <input
                type="color"
                value={c.hex || '#6366f1'}
                onChange={(e) => update(i, { hex: e.target.value })}
                className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-black/10 dark:border-border bg-transparent"
              />
              <Input
                value={c.hex}
                onChange={(e) => update(i, { hex: e.target.value })}
                placeholder="#000000"
                className="h-8 w-28 shrink-0 font-mono text-xs"
              />
              <Input
                value={c.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Label"
                className="h-8 flex-1 text-sm"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                aria-label="Remove color"
              >
                <Trash2Icon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
