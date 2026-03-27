'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { COMPACT_LAYOUTS, LARGE_LAYOUTS } from '@/features/line-oa/webhook/rich-menu/layouts';
import type { LayoutDef } from '@/features/line-oa/webhook/rich-menu/layouts';

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (layout: LayoutDef) => void;
};

// Render an SVG thumbnail preview of a layout
function LayoutThumbnail({ layout }: { layout: LayoutDef }) {
  const W = 120;
  const H = layout.sizeType === 'large' ? 80 : 40;
  const scaleX = W / layout.width;
  const scaleY = H / layout.height;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="rounded overflow-hidden"
    >
      <rect width={W} height={H} fill="#e5e7eb" />
      {layout.areas.map((b, i) => (
        <g key={i}>
          <rect
            x={b.x * scaleX + 1}
            y={b.y * scaleY + 1}
            width={b.width * scaleX - 2}
            height={b.height * scaleY - 2}
            fill="#cbd5e1"
            rx={2}
          />
        </g>
      ))}
    </svg>
  );
}

function LayoutSection({
  title,
  subtitle,
  layouts,
  onSelect,
}: {
  title: string;
  subtitle: string;
  layouts: LayoutDef[];
  onSelect: (l: LayoutDef) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-[#06C755]">{subtitle}</p>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {layouts.map((layout) => (
          <button
            key={layout.id}
            type="button"
            onClick={() => onSelect(layout)}
            className="group flex flex-col items-center gap-1.5 rounded-lg border p-2 hover:border-[#06C755] hover:bg-green-50 dark:hover:bg-green-950/20 transition"
          >
            <LayoutThumbnail layout={layout} />
            <span className="text-[10px] text-muted-foreground group-hover:text-foreground text-center leading-tight">
              {layout.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function RichMenuLayoutPicker({ open, onClose, onSelect }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select a layout</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-1">
          <LayoutSection
            title="Large (2500 × 1686 pixels)"
            subtitle="A larger menu for displaying more items."
            layouts={LARGE_LAYOUTS}
            onSelect={onSelect}
          />
          <div className="border-t" />
          <LayoutSection
            title="Compact (2500 × 843 pixels)"
            subtitle="A less obtrusive menu to be used together with chat functions."
            layouts={COMPACT_LAYOUTS}
            onSelect={onSelect}
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
