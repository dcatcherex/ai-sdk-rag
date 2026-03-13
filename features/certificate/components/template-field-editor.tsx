'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { Crosshair, Magnet, Maximize2, Minus, MoveDiagonal, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getCertificateFontCssWeight, resolveCertificateFontWeight } from '@/lib/certificate-fonts';
import { cn } from '@/lib/utils';
import type { CertificateTemplate, TextFieldConfig } from '../types';

type EditableFieldRow = TextFieldConfig & { _key: string };

type Props = {
  template: CertificateTemplate;
  rows: EditableFieldRow[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onUpdateField: <K extends keyof EditableFieldRow>(key: string, prop: K, value: EditableFieldRow[K]) => void;
  imageVariant?: 'thumbnail' | 'back_thumbnail';
};

type PreviewSize = {
  width: number;
  height: number;
};

type DragState = {
  key: string;
  startClientX: number;
  startClientY: number;
  anchorOffsetXPercent: number;
  anchorOffsetYPercent: number;
  hasMoved: boolean;
};

type ResizeState = {
  key: string;
};

type GuideState = {
  x: number | null;
  y: number | null;
};

const DEFAULT_GUIDES: GuideState = { x: null, y: null };
const SNAP_THRESHOLD_PERCENT = 1.5;
const NUDGE_STEP = 0.5;
const NUDGE_STEP_LARGE = 2;
const MIN_WIDTH_PERCENT = 10;
const MAX_ZOOM = 200;
const MIN_ZOOM = 50;
const ZOOM_STEP = 10;
const DRAG_START_THRESHOLD_PX = 4;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}

function getFieldTransform(align: TextFieldConfig['align']) {
  if (align === 'center') return 'translate(-50%, -50%)';
  if (align === 'right') return 'translate(-100%, -50%)';
  return 'translate(0, -50%)';
}

function getAnchorOffsetXPercent(field: EditableFieldRow, pointerPercent: number) {
  if (field.align === 'center') {
    return pointerPercent - field.xPercent + field.maxWidthPercent / 2;
  }

  if (field.align === 'right') {
    return pointerPercent - (field.xPercent - field.maxWidthPercent);
  }

  return pointerPercent - field.xPercent;
}

function getFieldWidthLimit(field: EditableFieldRow) {
  if (field.align === 'center') {
    return Math.max(MIN_WIDTH_PERCENT, Math.min(field.xPercent, 100 - field.xPercent) * 2);
  }

  if (field.align === 'right') {
    return Math.max(MIN_WIDTH_PERCENT, field.xPercent);
  }

  return Math.max(MIN_WIDTH_PERCENT, 100 - field.xPercent);
}

function getResizeHandlePosition(field: EditableFieldRow) {
  if (field.align === 'right') {
    return { left: 0, transform: 'translate(-50%, -50%)' };
  }

  return { right: 0, transform: 'translate(50%, -50%)' };
}

function calcFittedFontSize(text: string, maxWidthPx: number, baseFontSize: number, minFontSize: number) {
  if (!text.trim()) return baseFontSize;

  const charWidthRatio = 0.55;
  const textWidthAtBase = text.length * baseFontSize * charWidthRatio;
  if (textWidthAtBase <= maxWidthPx) return baseFontSize;

  const scaled = Math.floor((maxWidthPx / textWidthAtBase) * baseFontSize);
  return Math.max(scaled, minFontSize);
}

function getDefaultPreviewValue(field: EditableFieldRow) {
  const fieldName = `${field.id} ${field.label}`.toLowerCase();

  if (fieldName.includes('name')) {
    return 'Thirathat Thongkaew';
  }

  if (fieldName.includes('date')) {
    return 'held on 21 February 2026 at Navamin 9 Hospital';
  }

  if (fieldName.includes('hospital') || fieldName.includes('location') || fieldName.includes('venue')) {
    return 'Navamin 9 Hospital';
  }

  return field.label || field.id;
}

export function TemplateFieldEditor({ template, rows, selectedKey, onSelect, onUpdateField, imageVariant = 'thumbnail' }: Props) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [previewSize, setPreviewSize] = useState<PreviewSize>({ width: 0, height: 0 });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [guideState, setGuideState] = useState<GuideState>(DEFAULT_GUIDES);
  const [previewValues, setPreviewValues] = useState<Record<string, string>>(() => {
    return Object.fromEntries(rows.map((row) => [row._key, getDefaultPreviewValue(row)]));
  });
  const [zoom, setZoom] = useState(100);

  const selectedField = useMemo(
    () => rows.find((row) => row._key === selectedKey) ?? null,
    [rows, selectedKey],
  );

  const selectedPreviewValue = selectedField ? (previewValues[selectedField._key] ?? getDefaultPreviewValue(selectedField)) : '';

  const selectedRenderedFontSize = selectedField
    ? calcFittedFontSize(
        selectedPreviewValue,
        (selectedField.maxWidthPercent / 100) * template.width,
        selectedField.fontSize,
        selectedField.minFontSize,
      )
    : null;

  useEffect(() => {
    const element = previewRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setPreviewSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setPreviewValues((prev) => {
      const nextValues: Record<string, string> = {};

      for (const row of rows) {
        nextValues[row._key] = prev[row._key] ?? getDefaultPreviewValue(row);
      }

      return nextValues;
    });
  }, [rows]);

  useEffect(() => {
    if (!dragState) return;

    const activeKey = dragState.key;
    const { startClientX, startClientY, anchorOffsetXPercent, anchorOffsetYPercent, hasMoved } = dragState;

    function handlePointerMove(event: PointerEvent) {
      const deltaX = event.clientX - startClientX;
      const deltaY = event.clientY - startClientY;
      const nextHasMoved = hasMoved || Math.hypot(deltaX, deltaY) >= DRAG_START_THRESHOLD_PX;

      if (!nextHasMoved) {
        return;
      }

      updatePositionFromPoint(
        activeKey,
        event.clientX,
        event.clientY,
        anchorOffsetXPercent,
        anchorOffsetYPercent,
      );

      if (!hasMoved) {
        setDragState((prev) => {
          if (!prev || prev.key !== activeKey) return prev;
          return { ...prev, hasMoved: true };
        });
      }
    }

    function handlePointerUp() {
      setDragState(null);
      setGuideState(DEFAULT_GUIDES);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, rows, snapEnabled]);

  useEffect(() => {
    if (!resizeState) return;

    const activeKey = resizeState.key;

    function handlePointerMove(event: PointerEvent) {
      updateWidthFromPoint(activeKey, event.clientX);
    }

    function handlePointerUp() {
      setResizeState(null);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [resizeState, rows]);

  function updatePositionFromPoint(
    key: string,
    clientX: number,
    clientY: number,
    anchorOffsetXPercent?: number,
    anchorOffsetYPercent?: number,
  ) {
    const preview = previewRef.current;
    const field = rows.find((row) => row._key === key);
    if (!preview || !field) return;

    const rect = preview.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const pointerXPercent = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    const pointerYPercent = clamp(((clientY - rect.top) / rect.height) * 100, 0, 100);

    const effectiveAnchorXPercent = anchorOffsetXPercent ?? field.maxWidthPercent / 2;
    const effectiveAnchorYPercent = anchorOffsetYPercent ?? 0;

    let rawX = pointerXPercent;

    if (field.align === 'center') {
      rawX = pointerXPercent - effectiveAnchorXPercent + field.maxWidthPercent / 2;
    } else if (field.align === 'right') {
      rawX = pointerXPercent - effectiveAnchorXPercent + field.maxWidthPercent;
    } else {
      rawX = pointerXPercent - effectiveAnchorXPercent;
    }

    const rawY = pointerYPercent - effectiveAnchorYPercent;

    const minX = field.align === 'center'
      ? field.maxWidthPercent / 2
      : field.align === 'right'
        ? field.maxWidthPercent
        : 0;
    const maxX = field.align === 'center'
      ? 100 - field.maxWidthPercent / 2
      : field.align === 'right'
        ? 100
        : 100 - field.maxWidthPercent;

    rawX = clamp(rawX, minX, maxX);
    const clampedY = clamp(rawY, 0, 100);

    const xCandidates = [50, ...rows.filter((row) => row._key !== key).map((row) => row.xPercent)];
    const yCandidates = [50, ...rows.filter((row) => row._key !== key).map((row) => row.yPercent)];

    let snappedX = rawX;
    let snappedY = clampedY;
    let guideX: number | null = null;
    let guideY: number | null = null;

    if (snapEnabled) {
      const closestX = xCandidates.reduce<{ value: number; distance: number } | null>((closest, value) => {
        const distance = Math.abs(value - rawX);
        if (closest === null || distance < closest.distance) {
          return { value, distance };
        }
        return closest;
      }, null);

      const closestY = yCandidates.reduce<{ value: number; distance: number } | null>((closest, value) => {
        const distance = Math.abs(value - rawY);
        if (closest === null || distance < closest.distance) {
          return { value, distance };
        }
        return closest;
      }, null);

      if (closestX && closestX.distance <= SNAP_THRESHOLD_PERCENT) {
        snappedX = closestX.value;
        guideX = closestX.value;
      }

      if (closestY && closestY.distance <= SNAP_THRESHOLD_PERCENT) {
        snappedY = closestY.value;
        guideY = closestY.value;
      }
    }

    setGuideState({ x: guideX, y: guideY });
    onUpdateField(key, 'xPercent', roundPercent(snappedX));
    onUpdateField(key, 'yPercent', roundPercent(snappedY));
  }

  function updateWidthFromPoint(key: string, clientX: number) {
    const preview = previewRef.current;
    const field = rows.find((row) => row._key === key);
    if (!preview || !field) return;

    const rect = preview.getBoundingClientRect();
    if (rect.width === 0) return;

    const pointerPercent = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    const maxWidthPercent = getFieldWidthLimit(field);

    let nextWidth = field.maxWidthPercent;

    if (field.align === 'center') {
      nextWidth = Math.abs(pointerPercent - field.xPercent) * 2;
    } else if (field.align === 'right') {
      nextWidth = field.xPercent - pointerPercent;
    } else {
      nextWidth = pointerPercent - field.xPercent;
    }

    onUpdateField(key, 'maxWidthPercent', roundPercent(clamp(nextWidth, MIN_WIDTH_PERCENT, maxWidthPercent)));
  }

  function handleFieldPointerDown(key: string, event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    onSelect(key);
    previewRef.current?.focus();
    setResizeState(null);

    const preview = previewRef.current;
    const field = rows.find((row) => row._key === key);
    let anchorOffsetXPercent = 0;
    let anchorOffsetYPercent = 0;

    if (preview && field) {
      const rect = preview.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const pointerXPercent = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
        const pointerYPercent = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
        anchorOffsetXPercent = getAnchorOffsetXPercent(field, pointerXPercent);
        anchorOffsetYPercent = pointerYPercent - field.yPercent;
      }
    }

    setDragState({
      key,
      startClientX: event.clientX,
      startClientY: event.clientY,
      anchorOffsetXPercent,
      anchorOffsetYPercent,
      hasMoved: false,
    });
  }

  function handleResizePointerDown(key: string, event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onSelect(key);
    previewRef.current?.focus();
    setDragState(null);
    setResizeState({ key });
    updateWidthFromPoint(key, event.clientX);
  }

  function updateZoom(nextZoom: number) {
    setZoom(clamp(nextZoom, MIN_ZOOM, MAX_ZOOM));
  }

  function updatePreviewValue(key: string, value: string) {
    setPreviewValues((prev) => ({ ...prev, [key]: value }));
  }

  function resetPreviewValues() {
    setPreviewValues(Object.fromEntries(rows.map((row) => [row._key, getDefaultPreviewValue(row)])));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!selectedField) return;

    const step = event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
    setGuideState(DEFAULT_GUIDES);

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onUpdateField(selectedField._key, 'xPercent', roundPercent(clamp(selectedField.xPercent - step, 0, 100)));
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      onUpdateField(selectedField._key, 'xPercent', roundPercent(clamp(selectedField.xPercent + step, 0, 100)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      onUpdateField(selectedField._key, 'yPercent', roundPercent(clamp(selectedField.yPercent - step, 0, 100)));
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      onUpdateField(selectedField._key, 'yPercent', roundPercent(clamp(selectedField.yPercent + step, 0, 100)));
    }
  }

  function centerSelected(axis: 'x' | 'y') {
    if (!selectedField) return;
    if (axis === 'x') {
      onUpdateField(selectedField._key, 'xPercent', 50);
      setGuideState((prev) => ({ ...prev, x: 50 }));
      return;
    }
    onUpdateField(selectedField._key, 'yPercent', 50);
    setGuideState((prev) => ({ ...prev, y: 50 }));
  }

  const scale = previewSize.width > 0 ? previewSize.width / template.width : 1;
  const previewUrl = `/api/certificate/files?templateId=${encodeURIComponent(template.id)}&variant=${encodeURIComponent(imageVariant)}&v=${encodeURIComponent(template.updatedAt)}`;

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-border">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h4 className="font-medium">Visual editor</h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Drag fields on the certificate preview. Click a field to edit it, then use arrow keys to nudge by 0.5%.
            Hold Shift for 2% steps.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-600 dark:border-border dark:text-zinc-300">
            <MoveDiagonal className="h-3 w-3" /> Drag to move
          </div>
          <div className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-600 dark:border-border dark:text-zinc-300">
            <Crosshair className="h-3 w-3" /> Snap guides
          </div>
          <Button size="sm" variant={snapEnabled ? 'default' : 'outline'} onClick={() => setSnapEnabled((prev) => !prev)}>
            <Magnet className="mr-1 h-3.5 w-3.5" />
            {snapEnabled ? 'Snap on' : 'Snap off'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => centerSelected('x')} disabled={!selectedField}>
            Center X
          </Button>
          <Button size="sm" variant="outline" onClick={() => centerSelected('y')} disabled={!selectedField}>
            Center Y
          </Button>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-border dark:bg-zinc-900/40">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h5 className="text-sm font-medium">Preview sample values</h5>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                These are only for preview so you can judge the real look before generating.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={resetPreviewValues}>
              Reset samples
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {rows.map((row) => (
              <div key={row._key} className="space-y-1">
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">{row.label || row.id}</p>
                <Input
                  value={previewValues[row._key] ?? ''}
                  onChange={(event) => updatePreviewValue(row._key, event.target.value)}
                  onFocus={() => onSelect(row._key)}
                  placeholder={getDefaultPreviewValue(row)}
                  className="h-9 text-xs"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2 dark:border-border dark:bg-zinc-900/50">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Zoom changes the preview scale only.</p>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateZoom(zoom - ZOOM_STEP)} disabled={zoom <= MIN_ZOOM}>
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => updateZoom(100)}>
                <Maximize2 className="mr-1 h-3.5 w-3.5" /> {zoom}%
              </Button>
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateZoom(zoom + ZOOM_STEP)} disabled={zoom >= MAX_ZOOM}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="overflow-auto rounded-2xl border border-zinc-200 bg-white p-3 dark:border-border dark:bg-zinc-950">
            <div className="mx-auto" style={{ width: `${zoom}%` }}>
              <div
                ref={previewRef}
                tabIndex={0}
                onKeyDown={handleKeyDown}
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
                        onClick={() => onSelect(row._key)}
                        onPointerDown={(event) => handleFieldPointerDown(row._key, event)}
                        className={cn(
                          'w-full cursor-move rounded-md border px-2 py-1 text-center shadow-sm transition focus:outline-none',
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
                          touchAction: 'none',
                          opacity: isPlaceholder ? 0.5 : 1,
                        }}
                      >
                        {isPlaceholder ? `[${row.id}]` : previewText}
                      </button>

                      {isSelected && (
                        <button
                          type="button"
                          onPointerDown={(event) => handleResizePointerDown(row._key, event)}
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

        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/60 p-3 dark:border-border dark:bg-zinc-900/40">
          <div className="space-y-3 text-xs text-zinc-600 dark:text-zinc-300">
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-100">Selected field</p>
              {selectedField ? (
                <div className="mt-2 space-y-1">
                  <p className="font-mono text-[11px]">{selectedField.id}</p>
                  <p>{selectedField.label || 'Untitled field'}</p>
                </div>
              ) : (
                <p className="mt-2 text-zinc-500 dark:text-zinc-400">Choose a field to adjust it visually.</p>
              )}
            </div>

            {selectedField && (
              <>
                <div className="space-y-1">
                  <p>X: {selectedField.xPercent.toFixed(1)}%</p>
                  <p>Y: {selectedField.yPercent.toFixed(1)}%</p>
                  <p>Width: {selectedField.maxWidthPercent}%</p>
                  <p>Sample: {selectedPreviewValue || `[${selectedField.id}]`}</p>
                  <p>Font: {selectedField.fontSize}px base → {selectedRenderedFontSize ?? selectedField.fontSize}px rendered</p>
                  <p>Zoom: {zoom}%</p>
                </div>
                <div className="space-y-1 text-zinc-500 dark:text-zinc-400">
                  <p>Tip: click the preview first, then use arrow keys for precise nudging.</p>
                  <p>Tip: drag near the center or another field to snap into alignment.</p>
                  <p>Tip: drag the round handle to resize the field width.</p>
                  <p>Tip: if rendered font is much smaller than base, increase width or reduce text length.</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
