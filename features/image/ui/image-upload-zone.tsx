'use client';

import { FileUploadZone } from '@/components/ui/file-upload-zone';

interface Props {
  images: string[];
  onAdd: (b64: string) => void;
  onRemove: (i: number) => void;
  required?: boolean;
  disabled?: boolean;
  maxFiles?: number;
}

export function ImageUploadZone({ images, onAdd, onRemove, required, disabled, maxFiles }: Props) {
  return (
    <FileUploadZone
      files={images}
      onAdd={onAdd}
      onRemove={onRemove}
      label="Reference images"
      accept="image/*"
      multiple
      required={required}
      disabled={disabled}
      maxFiles={maxFiles}
      hint={required
        ? 'At least 1 reference image required for this model.'
        : 'Optional: add reference images to guide generation.'}
    />
  );
}
