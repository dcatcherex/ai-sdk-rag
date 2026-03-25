'use client';

import { useRef, useState, useCallback } from 'react';
import { Upload, X, ImageIcon, FileIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface FileUploadZoneProps {
  /** Files as base64 data URLs or https:// URLs */
  files: string[];
  onAdd: (dataUrl: string) => void;
  onRemove: (index: number) => void;
  /** Input label */
  label?: string;
  /** MIME accept string — e.g. "image/*" or "image/*,video/*" */
  accept?: string;
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
  /** Custom hint text below the zone */
  hint?: string;
  maxFiles?: number;
  /** Show image thumbnails (auto-detected from accept when not set) */
  showPreviews?: boolean;
}

export function FileUploadZone({
  files,
  onAdd,
  onRemove,
  label = 'Files',
  accept = 'image/*',
  multiple = true,
  required,
  disabled,
  hint,
  maxFiles,
  showPreviews,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const isImage = showPreviews ?? accept.includes('image');
  const canAddMore = maxFiles === undefined || files.length < maxFiles;

  const processFiles = useCallback((fileList: FileList | null) => {
    if (!fileList || disabled) return;
    const toProcess = maxFiles ? Array.from(fileList).slice(0, maxFiles - files.length) : Array.from(fileList);
    toProcess.forEach(file => {
      const reader = new FileReader();
      reader.onload = e => { if (e.target?.result) onAdd(e.target.result as string); };
      reader.readAsDataURL(file);
    });
  }, [disabled, files.length, maxFiles, onAdd]);

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.items.length > 0) setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (disabled || !canAddMore) return;
    processFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>

      <div
        className={cn(
          'relative rounded-lg border-2 border-dashed transition-colors',
          isDragging && !disabled
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-muted-foreground/50',
          disabled && 'opacity-50 pointer-events-none',
        )}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 rounded-lg flex items-center justify-center bg-primary/10 z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-1.5 text-primary">
              <Upload className="h-6 w-6" />
              <span className="text-sm font-medium">Drop to upload</span>
            </div>
          </div>
        )}

        <div className="p-3">
          {files.length === 0 ? (
            /* Empty state — full-zone click target */
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              className="w-full flex flex-col items-center gap-2 py-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Upload className="h-6 w-6" />
              <div className="text-center">
                <p className="text-sm font-medium">Click to upload or drag & drop</p>
                <p className="text-xs opacity-70 mt-0.5">{accept.replace('/*', ' files')}</p>
              </div>
            </button>
          ) : (
            /* Thumbnails + add button */
            <div className="flex flex-wrap gap-2">
              {files.map((src, i) => (
                <div key={i} className="relative w-16 h-16 rounded-md border overflow-hidden shrink-0">
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <FileIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemove(i)}
                    disabled={disabled}
                    className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 hover:bg-black/80 transition-colors"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}

              {canAddMore && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={disabled}
                  className="w-16 h-16 rounded-md border-2 border-dashed flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors shrink-0"
                >
                  {isImage ? <ImageIcon className="h-4 w-4" /> : <FileIcon className="h-4 w-4" />}
                  <span className="text-[10px]">Add</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={e => processFiles(e.target.files)}
      />

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {!hint && (
        <p className="text-xs text-muted-foreground">
          {required
            ? 'At least 1 file required.'
            : `Optional${maxFiles ? ` — up to ${maxFiles} files` : ''}.`}
        </p>
      )}
    </div>
  );
}
