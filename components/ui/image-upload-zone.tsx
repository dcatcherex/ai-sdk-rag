'use client';

import { useRef, useState } from 'react';
import { ImageIcon, UploadCloudIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type ImageUploadZoneProps = {
  /** Current image URL. Empty string = no image. */
  value: string;
  onChange: (url: string) => void;
  /**
   * Called when the user selects or drops a file.
   * Should upload the file and return the public URL.
   * Throw an Error with a user-readable message on failure.
   */
  onUpload: (file: File) => Promise<string>;
  label?: string;
  hint?: string;
  disabled?: boolean;
  /** CSS class added to the outer wrapper */
  className?: string;
};

/**
 * Reusable image upload zone with drag-and-drop support.
 * Uploads immediately on file selection via the `onUpload` callback.
 * Displays the returned URL as a preview thumbnail.
 *
 * Use this for all server-side image uploads (→ R2 → URL stored in DB).
 * Do not use for base64 / local-preview flows — use FileUploadZone instead.
 */
export function ImageUploadZone({
  value,
  onChange,
  onUpload,
  label,
  hint = 'JPEG, PNG, WebP · max 2 MB',
  disabled,
  className,
}: ImageUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleFile = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const url = await onUpload(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (!disabled && e.dataTransfer.items.length > 0) setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const dropZoneProps = {
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDrop,
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <p className="text-sm font-medium leading-none">{label}</p>
      )}

      <div
        {...dropZoneProps}
        className={cn(
          'relative flex items-start gap-3 rounded-xl border-2 border-dashed p-3 transition-colors',
          isDragging && !disabled
            ? 'border-primary bg-primary/5'
            : 'border-input hover:border-muted-foreground/40',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 rounded-[10px] bg-primary/10 pointer-events-none">
            <UploadCloudIcon className="size-6 text-primary" />
            <span className="text-xs font-medium text-primary">Drop to upload</span>
          </div>
        )}

        {/* Thumbnail */}
        <button
          type="button"
          onClick={() => !disabled && !uploading && inputRef.current?.click()}
          disabled={disabled || uploading}
          className="relative size-16 shrink-0 rounded-lg border border-input bg-muted/40 overflow-hidden flex items-center justify-center group hover:bg-muted/70 transition"
          title={value ? 'Click to change image' : 'Click to upload'}
        >
          {value ? (
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground group-hover:text-foreground transition" />
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <span className="size-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          )}
          {!uploading && value && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
              <UploadCloudIcon className="size-4 text-white" />
            </div>
          )}
        </button>

        {/* Controls */}
        <div className="flex flex-col gap-1.5 pt-0.5 min-w-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            className="w-fit"
          >
            {uploading ? 'Uploading…' : value ? 'Change image' : 'Upload image'}
          </Button>
          {value && !uploading && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit h-7 text-xs text-destructive hover:text-destructive px-2"
              onClick={() => { onChange(''); setError(null); }}
            >
              <XIcon className="size-3 mr-1" />
              Remove
            </Button>
          )}
          <p className="text-xs text-muted-foreground">{hint}</p>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
