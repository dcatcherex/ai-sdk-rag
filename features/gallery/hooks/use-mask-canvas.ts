import { useRef, useState } from 'react';
import { getCanvasCoordinates } from '../utils';

export type ActiveTool = 'paint' | 'erase' | 'rect';

export const useMaskCanvas = () => {
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const rectStartRef = useRef<{ x: number; y: number } | null>(null);
  const canvasHistoryRef = useRef<ImageData[]>([]);
  const canvasRedoRef = useRef<ImageData[]>([]);

  const [brushSize, setBrushSize] = useState(20);
  const [activeTool, setActiveTool] = useState<ActiveTool>('paint');

  const saveToHistory = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvasHistoryRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    canvasRedoRef.current = [];
  };

  const undoMask = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas || canvasHistoryRef.current.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvasRedoRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    const prev = canvasHistoryRef.current.pop()!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(prev, 0, 0);
  };

  const redoMask = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas || canvasRedoRef.current.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvasHistoryRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    const next = canvasRedoRef.current.pop()!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(next, 0, 0);
  };

  const clearMask = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const drawAtPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const { x, y } = getCanvasCoordinates(canvas, event);

    if (activeTool === 'erase') {
      context.globalCompositeOperation = 'destination-out';
      context.fillStyle = 'rgba(0, 0, 0, 1)';
    } else {
      context.globalCompositeOperation = 'source-over';
      context.fillStyle = 'rgba(220, 38, 38, 0.7)';
    }
    context.beginPath();
    context.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = 'source-over';
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    saveToHistory();
    isDrawingRef.current = true;
    if (activeTool === 'rect') {
      const canvas = maskCanvasRef.current;
      if (canvas) rectStartRef.current = getCanvasCoordinates(canvas, event);
    } else {
      drawAtPoint(event);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || activeTool === 'rect') return;
    drawAtPoint(event);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTool === 'rect' && rectStartRef.current && isDrawingRef.current) {
      const canvas = maskCanvasRef.current;
      if (canvas) {
        const context = canvas.getContext('2d');
        if (context) {
          const { x, y } = getCanvasCoordinates(canvas, event);
          const start = rectStartRef.current;
          context.fillStyle = 'rgba(220, 38, 38, 0.7)';
          context.fillRect(start.x, start.y, x - start.x, y - start.y);
        }
      }
      rectStartRef.current = null;
    }
    isDrawingRef.current = false;
  };

  const buildMaskDataUrl = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');
    if (!context) return undefined;

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const hasMask = pixels.some((_, index) => index % 4 === 3 && pixels[index] > 0);
    if (!hasMask) return undefined;

    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    const outputContext = output.getContext('2d');
    if (!outputContext) return undefined;

    outputContext.fillStyle = '#ffffff';
    outputContext.fillRect(0, 0, output.width, output.height);
    outputContext.globalCompositeOperation = 'destination-out';
    outputContext.drawImage(canvas, 0, 0);
    return output.toDataURL('image/png');
  };

  /** Call when switching to a different version to resize + clear the canvas. */
  const initCanvas = (width: number, height: number) => {
    canvasHistoryRef.current = [];
    canvasRedoRef.current = [];
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.clearRect(0, 0, width, height);
  };

  return {
    maskCanvasRef,
    brushSize,
    setBrushSize,
    activeTool,
    setActiveTool,
    saveToHistory,
    undoMask,
    redoMask,
    clearMask,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    buildMaskDataUrl,
    initCanvas,
  };
};
