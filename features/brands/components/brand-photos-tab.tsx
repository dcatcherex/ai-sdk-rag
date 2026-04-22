'use client';

import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Images, Loader2, Tag, Trash2, Upload, UploadCloudIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type Photo = {
  id: string;
  url: string;
  filename: string | null;
  tags: string[];
  usageCount: number;
};

export function BrandPhotosTab({ brandId }: { brandId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tagInput, setTagInput] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const { data, isLoading } = useQuery<{ photos: Photo[] }>({
    queryKey: ['brand-photos', brandId],
    queryFn: () => fetch(`/api/brand-photos?brandId=${brandId}`).then((r) => r.json()),
  });

  const photos = data?.photos ?? [];
  const allTags = [...new Set(photos.flatMap((p) => p.tags))].sort();
  const visible = activeFilter ? photos.filter((p) => p.tags.includes(activeFilter)) : photos;

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const tags = tagInput.split(',').map((t) => t.trim()).filter(Boolean);
      await Promise.all(
        Array.from(files).map((file) => {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('brandId', brandId);
          if (tags.length) fd.append('tags', tags.join(','));
          return fetch('/api/brand-photos', { method: 'POST', body: fd }).then((r) => {
            if (!r.ok) return r.text().then((t) => { throw new Error(t); });
          });
        }),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand-photos', brandId] });
      setTagInput('');
      if (fileRef.current) fileRef.current.value = '';
    },
  });

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
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (uploadMutation.isPending) return;
    const files = e.dataTransfer.files;
    if (files.length) uploadMutation.mutate(files);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch('/api/brand-photos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, brandId }),
      }).then((r) => { if (!r.ok) throw new Error('Delete failed'); }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand-photos', brandId] }),
  });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Brand Photos</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Upload product photos, activity shots, and event images. AI picks from these automatically when creating social posts, spread evenly across all uploads.
        </p>
      </div>

      {/* Upload area */}
      <div
        className={cn(
          'relative rounded-lg border-2 border-dashed p-4 space-y-3 transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-black/8 dark:border-border hover:border-muted-foreground/30',
        )}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 rounded-md bg-primary/10 pointer-events-none">
            <UploadCloudIcon className="size-6 text-primary" />
            <span className="text-xs font-medium text-primary">Drop to upload</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            placeholder="Tags: e.g. summer-camp, event-2025 (comma separated)"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) uploadMutation.mutate(e.target.files);
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-3.5 w-3.5" />
            )}
            {uploadMutation.isPending ? 'Uploading…' : 'Upload Photos'}
          </Button>
          <span className="text-xs text-muted-foreground">JPEG, PNG, WebP · up to 10 MB · multiple OK</span>
        </div>
        {uploadMutation.isError && (
          <p className="text-xs text-destructive">{(uploadMutation.error as Error).message}</p>
        )}
      </div>


      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveFilter(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !activeFilter ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            All ({photos.length})
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveFilter(activeFilter === tag ? null : tag)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeFilter === tag ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {tag} ({photos.filter((p) => p.tags.includes(tag)).length})
            </button>
          ))}
        </div>
      )}

      {/* Photo grid */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border bg-muted/20 py-10 text-center">
          <Images className="h-7 w-7 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {activeFilter ? `No photos tagged "${activeFilter}"` : 'No photos yet — upload some above'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {visible.map((photo) => (
            <div key={photo.id} className="group relative overflow-hidden rounded-lg border bg-muted/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.filename ?? 'Brand photo'}
                className="aspect-square w-full object-cover"
              />
              <div className="absolute inset-0 flex flex-col justify-between p-1.5 opacity-0 transition-opacity group-hover:opacity-100 bg-black/40">
                <button
                  onClick={() => deleteMutation.mutate(photo.id)}
                  disabled={deleteMutation.isPending}
                  className="self-end rounded bg-destructive/90 p-1 text-white hover:bg-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
                <div className="flex flex-col gap-0.5">
                  {photo.tags.length > 0 && (
                    <div className="flex flex-wrap gap-0.5">
                      {photo.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px] px-1 py-0">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <span className="text-[10px] text-white/70">Used {photo.usageCount}×</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
