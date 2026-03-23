'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { Crosshair, Magnet, MoveDiagonal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CertificateTemplate } from '../../types';
import { PreviewCanvas } from './preview-canvas';
import {
  DEFAULT_GUIDES,
  SNAP_THRESHOLD_PERCENT,
  NUDGE_STEP,
  NUDGE_STEP_LARGE,
  MIN_WIDTH_PERCENT,
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
  DRAG_START_THRESHOLD_PX,
  clamp,
  roundPercent,
  getAnchorOffsetXPercent,
  getFieldWidthLimit,
  calcFittedFontSize as calcFittedFontSizeUtil,
  getDefaultPreviewValue as getDefaultPreviewValueUtil,
  type EditableFieldRow,
  type PreviewSize,
  type DragState,
  type ResizeState,
  type GuideState,
} from './utils';

type Props = {
  template: CertificateTemplate;
  rows: EditableFieldRow[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onUpdateField: <K extends keyof EditableFieldRow>(key: string, prop: K, value: EditableFieldRow[K]) => void;
  imageVariant?: 'thumbnail' | 'back_thumbnail';
};

export function TemplateFieldEditor({ template, rows, selectedKey, onSelect, onUpdateField, imageVariant = 'thumbnail' }: Props) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [previewSize, setPreviewSize] = useState<PreviewSize>({ width: 0, height: 0 });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [guideState, setGuideState] = useState<GuideState>(DEFAULT_GUIDES);
  const [previewValues, setPreviewValues] = useState<Record<string, string>>(() => {
    return Object.fromEntries(rows.map((row) => [row._key, getDefaultPreviewValueUtil(row)]));
  });
  const [isPreviewValuesHydrated, setIsPreviewValuesHydrated] = useState(false);
  const [zoom, setZoom] = useState(100);
  const previewStorageKey = `certificate-preview-values:${template.id}:${imageVariant}`;

  const selectedField = useMemo(
    () => rows.find((row) => row._key === selectedKey) ?? null,
    [rows, selectedKey],
  );

  const selectedPreviewValue = selectedField ? (previewValues[selectedField._key] ?? getDefaultPreviewValueUtil(selectedField)) : '';

  const selectedRenderedFontSize = selectedField
    ? calcFittedFontSizeUtil(
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
    if (typeof window === 'undefined') {
      return;
    }

    const storedValue = window.localStorage.getItem(previewStorageKey);
    if (!storedValue) {
      setPreviewValues(Object.fromEntries(rows.map((row) => [row._key, getDefaultPreviewValueUtil(row)])));
      setIsPreviewValuesHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(storedValue) as Record<string, string>;
      const nextValues: Record<string, string> = {};

      for (const row of rows) {
        nextValues[row._key] = parsed[row._key] ?? getDefaultPreviewValueUtil(row);
      }

      setPreviewValues(nextValues);
      setIsPreviewValuesHydrated(true);
    } catch {
      setPreviewValues(Object.fromEntries(rows.map((row) => [row._key, getDefaultPreviewValueUtil(row)])));
      setIsPreviewValuesHydrated(true);
    }
  }, [previewStorageKey, rows]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isPreviewValuesHydrated) {
      return;
    }

    window.localStorage.setItem(previewStorageKey, JSON.stringify(previewValues));
  }, [isPreviewValuesHydrated, previewStorageKey, previewValues]);

  useEffect(() => {
    setPreviewValues((prev) => {
      const nextValues: Record<string, string> = {};

      for (const row of rows) {
        nextValues[row._key] = prev[row._key] ?? getDefaultPreviewValueUtil(row);
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
    setPreviewValues(Object.fromEntries(rows.map((row) => [row._key, getDefaultPreviewValueUtil(row)])));
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
                  placeholder={getDefaultPreviewValueUtil(row)}
                  className="h-9 text-xs"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
        <PreviewCanvas
          template={template}
          rows={rows}
          selectedKey={selectedKey}
          previewValues={previewValues}
          dragState={dragState}
          guideState={guideState}
          zoom={zoom}
          previewUrl={previewUrl}
          previewRef={previewRef}
          scale={scale}
          onKeyDown={handleKeyDown}
          onFieldPointerDown={handleFieldPointerDown}
          onResizePointerDown={handleResizePointerDown}
          onSelectField={onSelect}
          onZoomIn={() => updateZoom(zoom + ZOOM_STEP)}
          onZoomOut={() => updateZoom(zoom - ZOOM_STEP)}
          onZoomReset={() => updateZoom(100)}
        />

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
