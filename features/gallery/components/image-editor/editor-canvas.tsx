import { useRef } from 'react';
import type { RefObject } from 'react';
import type { ActiveTool } from '../../hooks/use-mask-canvas';
import type { MediaAsset } from '../../types';

type Props = {
  selectedVersion: MediaAsset | null;
  maskCanvasRef: RefObject<HTMLCanvasElement | null>;
  brushSize: number;
  activeTool: ActiveTool;
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
};

export const EditorCanvas = ({
  selectedVersion,
  maskCanvasRef,
  brushSize,
  activeTool,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: Props) => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const rectPreviewRef = useRef<HTMLDivElement>(null);
  const rectStartRef = useRef<{ x: number; y: number } | null>(null);
  const showBrushCursor = activeTool === 'paint' || activeTool === 'erase';

  const getDisplayPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = maskCanvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const updateCursor = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = maskCanvasRef.current;
    const cursor = cursorRef.current;
    if (!canvas || !cursor) return;
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / canvas.width;
    const size = Math.max(brushSize * scale, 4);
    cursor.style.left = `${e.clientX - rect.left}px`;
    cursor.style.top = `${e.clientY - rect.top}px`;
    cursor.style.width = `${size}px`;
    cursor.style.height = `${size}px`;
    cursor.style.opacity = '1';
  };

  const hideCursor = () => {
    if (cursorRef.current) cursorRef.current.style.opacity = '0';
  };

  const updateRectPreview = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const preview = rectPreviewRef.current;
    const start = rectStartRef.current;
    if (!preview || !start) return;
    const pos = getDisplayPos(e);
    if (!pos) return;
    const x = Math.min(start.x, pos.x);
    const y = Math.min(start.y, pos.y);
    const w = Math.abs(pos.x - start.x);
    const h = Math.abs(pos.y - start.y);
    preview.style.left = `${x}px`;
    preview.style.top = `${y}px`;
    preview.style.width = `${w}px`;
    preview.style.height = `${h}px`;
    preview.style.opacity = '1';
  };

  const hideRectPreview = () => {
    rectStartRef.current = null;
    if (rectPreviewRef.current) rectPreviewRef.current.style.opacity = '0';
  };

  if (!selectedVersion) return null;

  const width = selectedVersion.width ?? 1024;
  const height = selectedVersion.height ?? 1024;

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={selectedVersion.url}
        alt="Source version"
        className="block max-h-[calc(100dvh-18rem)] max-w-[calc(100dvh-19rem)] w-auto"
      />
      <canvas
        ref={maskCanvasRef}
        width={width}
        height={height}
        onPointerDown={(e) => {
          if (activeTool === 'rect') {
            rectStartRef.current = getDisplayPos(e);
          }
          onPointerDown(e);
        }}
        onPointerMove={(e) => {
          updateCursor(e);
          if (activeTool === 'rect') updateRectPreview(e);
          onPointerMove(e);
        }}
        onPointerUp={(e) => { hideRectPreview(); onPointerUp(e); }}
        onPointerEnter={updateCursor}
        onPointerLeave={(e) => { hideCursor(); hideRectPreview(); onPointerUp(e); }}
        className={`absolute inset-0 h-full w-full rounded-2xl ${showBrushCursor ? 'cursor-none' : 'cursor-crosshair'}`}
      />
      {/* Brush size preview cursor */}
      {showBrushCursor && (
        <div
          ref={cursorRef}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 opacity-0 transition-opacity duration-75"
          style={{
            borderColor: activeTool === 'erase' ? 'rgba(255,255,255,0.8)' : 'rgba(220,38,38,0.9)',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
          }}
        />
      )}
      {/* Rect tool drag preview */}
      <div
        ref={rectPreviewRef}
        className="pointer-events-none absolute border-2 border-red-500/80 bg-red-500/20 opacity-0"
      />
    </div>
  );
};
