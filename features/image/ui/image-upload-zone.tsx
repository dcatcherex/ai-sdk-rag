'use client';

import { useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface Props {
  images: string[];
  onAdd: (b64: string) => void;
  onRemove: (i: number) => void;
  required?: boolean;
}

export function ImageUploadZone({ images, onAdd, onRemove, required }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => { if (e.target?.result) onAdd(e.target.result as string); };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1">
        Reference images {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="flex flex-wrap gap-2">
        {images.map((src, i) => (
          <div key={i} className="relative w-16 h-16 rounded border overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="w-full h-full object-cover" />
            <button
              onClick={() => onRemove(i)}
              className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5"
            >
              <X className="h-3 w-3 text-white" />
            </button>
          </div>
        ))}
        <button
          onClick={() => ref.current?.click()}
          className="w-16 h-16 rounded border-2 border-dashed flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Upload className="h-4 w-4" />
          <span className="text-[10px]">Upload</span>
        </button>
      </div>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden"
        onChange={e => handleFiles(e.target.files)} />
      <p className="text-xs text-muted-foreground">
        {required ? 'At least 1 image required for this model.' : 'Optional: add reference images to guide generation.'}
      </p>
    </div>
  );
}
