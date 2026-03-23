'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCertificateFontCssWeight, resolveCertificateFontWeight } from '@/lib/certificate-fonts';
import { cn } from '@/lib/utils';
import type { CertificateTemplate } from '../../types';
import {
  calcFittedFontSize,
  getDefaultPreviewValue,
  getFieldTransform,
  getPreviewTextAlign,
  getResizeHandlePosition,
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
  type DragState,
  type EditableFieldRow,
  type GuideState,
} from './utils';

type Props = {
  template: CertificateTemplate;
  rows: EditableFieldRow[];
  selectedKey: string | null;
  previewValues: Record<string, string>;
  dragState: DragState | null;
  guideState: GuideState;
  zoom: number;
  previewUrl: string;
  previewRef: React.RefObject<HTMLDivElement | null>;
  scale: number;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onFieldPointerDown: (key: string, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onResizePointerDown: (key: string, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onSelectField: (key: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
};

export function PreviewCanvas({
  template,
  rows,
  selectedKey,
  previewValues,
  guideState,
  zoom,
  previewUrl,
  previewRef,
  scale,
  onKeyDown,
  onFieldPointerDown,
  onResizePointerDown,
  onSelectField,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2 dark:border-border dark:bg-zinc-900/50">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Zoom changes the preview scale only.</p>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={onZoomOut} disabled={zoom <= MIN_ZOOM}>
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" onClick={onZoomReset}>
            <Maximize2 className="mr-1 h-3.5 w-3.5" /> {zoom}%
          </Button>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={onZoomIn} disabled={zoom >= MAX_ZOOM}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="overflow-auto rounded-2xl border border-zinc-200 bg-white p-3 dark:border-border dark:bg-zinc-950">
        <div className="mx-auto" style={{ width: `${zoom}%` }}>
          <div
            ref={previewRef}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onPointerDown={() => previewRef.current?.focus()}
            className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white outline-none ring-0 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-border dark:bg-zinc-950"
            style={{ aspectRatio: `${template.width} / ${template.height}` }}
          >
            <img src={previewUrl} alt={template.name} className="h-full w-full select-none object-contain" draggable={false} />

            <div
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                backgroundImage: 'linear-gradient(to right, rgba(99,102,241,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.14) 1px, transparent 1px)',
                backgroundSize: '10% 10%',
              }}
            />

            {guideState.x !== null && (
              <div
                className="pointer-events-none absolute inset-y-0 w-px bg-indigo-500/80"
                style={{ left: `${guideState.x}%` }}
              />
            )}

            {guideState.y !== null && (
              <div
                className="pointer-events-none absolute inset-x-0 h-px bg-indigo-500/80"
                style={{ top: `${guideState.y}%` }}
              />
            )}

            {rows.map((row) => {
              const isSelected = row._key === selectedKey;
              const previewText = previewValues[row._key] ?? getDefaultPreviewValue(row);
              const fittedFontSize = calcFittedFontSize(
                previewText,
                (row.maxWidthPercent / 100) * template.width,
                row.fontSize,
                row.minFontSize,
              );
              const previewFontSize = fittedFontSize * scale;
              const handlePosition = getResizeHandlePosition(row);
              const isPlaceholder = !previewText.trim();
              const resolvedFontWeight = resolveCertificateFontWeight(row.fontFamily, row.fontWeight);

              return (
                <div
                  key={row._key}
                  className="absolute"
                  style={{
                    left: `${row.xPercent}%`,
                    top: `${row.yPercent}%`,
                    width: `${row.maxWidthPercent}%`,
                    transform: getFieldTransform(row.align),
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onSelectField(row._key)}
                    onPointerDown={(event) => onFieldPointerDown(row._key, event)}
                    className={cn(
                      'w-full cursor-move rounded-md border px-0 py-1 shadow-sm transition focus:outline-none',
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/12 ring-2 ring-indigo-400/60'
                        : 'border-white/80 bg-black/35 hover:bg-black/45',
                    )}
                    style={{
                      color: row.color,
                      fontFamily: row.fontFamily,
                      fontWeight: getCertificateFontCssWeight(resolvedFontWeight),
                      fontSize: `${Math.max(1, previewFontSize)}px`,
                      lineHeight: 1.1,
                      textAlign: getPreviewTextAlign(row.align),
                      touchAction: 'none',
                      opacity: isPlaceholder ? 0.5 : 1,
                    }}
                  >
                    {isPlaceholder ? `[${row.id}]` : previewText}
                  </button>

                  {isSelected && (
                    <button
                      type="button"
                      onPointerDown={(event) => onResizePointerDown(row._key, event)}
                      className="absolute top-1/2 h-4 w-4 rounded-full border border-white bg-indigo-500 shadow-md"
                      style={{
                        ...handlePosition,
                        touchAction: 'none',
                      }}
                      aria-label={`Resize ${row.label || row.id} width`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
