import type { TextFieldConfig } from '../../types';

export type EditableFieldRow = TextFieldConfig & { _key: string };
export type PreviewSize = { width: number; height: number };
export type DragState = { key: string; startClientX: number; startClientY: number; anchorOffsetXPercent: number; anchorOffsetYPercent: number; hasMoved: boolean };
export type ResizeState = { key: string };
export type GuideState = { x: number | null; y: number | null };

export const DEFAULT_GUIDES: GuideState = { x: null, y: null };
export const SNAP_THRESHOLD_PERCENT = 1.5;
export const NUDGE_STEP = 0.5;
export const NUDGE_STEP_LARGE = 2;
export const MIN_WIDTH_PERCENT = 10;
export const MAX_ZOOM = 200;
export const MIN_ZOOM = 50;
export const ZOOM_STEP = 10;
export const DRAG_START_THRESHOLD_PX = 4;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}

export function getFieldTransform(align: TextFieldConfig['align']) {
  if (align === 'center') return 'translate(-50%, -50%)';
  if (align === 'right') return 'translate(-100%, -50%)';
  return 'translate(0, -50%)';
}

export function getPreviewTextAlign(align: TextFieldConfig['align']) {
  if (align === 'center') return 'center';
  if (align === 'right') return 'right';
  return 'left';
}

export function getAnchorOffsetXPercent(field: EditableFieldRow, pointerPercent: number) {
  if (field.align === 'center') {
    return pointerPercent - field.xPercent + field.maxWidthPercent / 2;
  }

  if (field.align === 'right') {
    return pointerPercent - (field.xPercent - field.maxWidthPercent);
  }

  return pointerPercent - field.xPercent;
}

export function getFieldWidthLimit(field: EditableFieldRow) {
  if (field.align === 'center') {
    return Math.max(MIN_WIDTH_PERCENT, Math.min(field.xPercent, 100 - field.xPercent) * 2);
  }

  if (field.align === 'right') {
    return Math.max(MIN_WIDTH_PERCENT, field.xPercent);
  }

  return Math.max(MIN_WIDTH_PERCENT, 100 - field.xPercent);
}

export function getResizeHandlePosition(field: EditableFieldRow) {
  if (field.align === 'right') {
    return { left: 0, transform: 'translate(-50%, -50%)' };
  }

  return { right: 0, transform: 'translate(50%, -50%)' };
}

export function calcFittedFontSize(text: string, maxWidthPx: number, baseFontSize: number, minFontSize: number) {
  if (!text.trim()) return baseFontSize;

  const charWidthRatio = 0.55;
  const textWidthAtBase = text.length * baseFontSize * charWidthRatio;
  if (textWidthAtBase <= maxWidthPx) return baseFontSize;

  const scaled = Math.floor((maxWidthPx / textWidthAtBase) * baseFontSize);
  return Math.max(scaled, minFontSize);
}

export function getDefaultPreviewValue(field: EditableFieldRow) {
  const fieldName = `${field.id} ${field.label}`.toLowerCase();

  if (fieldName.includes('nickname') || fieldName.includes('nick name')) {
    return 'Jone';
  }

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
