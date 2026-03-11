import { EraserIcon, PaintbrushIcon, RotateCcwIcon, RotateCwIcon, SquareIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { ActiveTool } from '../../hooks/use-mask-canvas';

type Props = {
  activeTool: ActiveTool;
  brushSize: number;
  onToolChange: (tool: ActiveTool) => void;
  onBrushSizeChange: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
};

export const EditorToolbar = ({
  activeTool,
  brushSize,
  onToolChange,
  onBrushSizeChange,
  onUndo,
  onRedo,
  onClear,
}: Props) => {
  return (
    <div className="absolute left-4 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-1 rounded-2xl border border-black/5 dark:border-border bg-white/95 dark:bg-card/95 p-2 shadow-xl backdrop-blur">
      <Button
        variant={activeTool === 'paint' ? 'default' : 'ghost'}
        size="icon-sm"
        title="Paint mask"
        onClick={() => onToolChange('paint')}
      >
        <PaintbrushIcon className="size-3.5" />
      </Button>
      <Button
        variant={activeTool === 'erase' ? 'default' : 'ghost'}
        size="icon-sm"
        title="Erase mask"
        onClick={() => onToolChange('erase')}
      >
        <EraserIcon className="size-3.5" />
      </Button>
      <Button
        variant={activeTool === 'rect' ? 'default' : 'ghost'}
        size="icon-sm"
        title="Rectangle mask"
        onClick={() => onToolChange('rect')}
      >
        <SquareIcon className="size-3.5" />
      </Button>

      <Separator className="my-0.5 w-full" />

      <div className="size-5 rounded-md border border-black/10 bg-red-500" title="Mask color" />
      <span className="text-[10px] font-medium tabular-nums text-muted-foreground">{brushSize}px</span>
      <input
        type="range"
        min={4}
        max={80}
        step={2}
        value={brushSize}
        onChange={(e) => onBrushSizeChange(Number(e.target.value))}
        className="h-20 w-1.5 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
      />

      <Separator className="my-0.5 w-full" />

      <Button variant="ghost" size="icon-sm" title="Undo" onClick={onUndo}>
        <RotateCcwIcon className="size-3.5" />
      </Button>
      <Button variant="ghost" size="icon-sm" title="Redo" onClick={onRedo}>
        <RotateCwIcon className="size-3.5" />
      </Button>
      <Button variant="ghost" size="icon-sm" title="Clear mask" onClick={onClear}>
        <XIcon className="size-3.5 opacity-60" />
      </Button>
    </div>
  );
};
