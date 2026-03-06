import type { RefObject } from 'react';
import type { MediaAsset } from '../../types';

type Props = {
  selectedVersion: MediaAsset | null;
  maskCanvasRef: RefObject<HTMLCanvasElement | null>;
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
};

export const EditorCanvas = ({
  selectedVersion,
  maskCanvasRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: Props) => {
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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        className="absolute inset-0 h-full w-full cursor-crosshair rounded-2xl"
      />
    </div>
  );
};
