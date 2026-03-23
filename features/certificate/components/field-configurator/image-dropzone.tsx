'use client';

import { ImageUp, Upload } from 'lucide-react';

type Props = {
  activeSide: 'front' | 'back';
  isReplaceDragActive: boolean;
  isPending: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onDragOver: (event: React.DragEvent<HTMLElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLElement>) => void;
  onDrop: (event: React.DragEvent<HTMLElement>) => void;
  onFileChange: (file: File) => void;
};

export function ImageDropzone({
  activeSide,
  isReplaceDragActive,
  isPending,
  inputRef,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
}: Props) {
  return (
    <>
      <div
        data-certificate-image-dropzone="true"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border border-dashed px-4 py-3 text-xs transition-colors ${isReplaceDragActive ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-300' : 'border-zinc-200 text-zinc-500 dark:border-border dark:text-zinc-400'}`}
      >
        <div className="flex items-center gap-2">
          {isReplaceDragActive ? <Upload className="h-4 w-4" /> : <ImageUp className="h-4 w-4" />}
          <span>
            {isReplaceDragActive
              ? `Drop a PNG, JPG, or WebP to replace the ${activeSide} image`
              : <>Drag and drop a PNG, JPG, or WebP here to replace the <span className="font-medium text-zinc-700 dark:text-zinc-200">{activeSide}</span> image, or click to browse.</>}
          </span>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onFileChange(file);
          }
          event.currentTarget.value = '';
        }}
      />
    </>
  );
}
