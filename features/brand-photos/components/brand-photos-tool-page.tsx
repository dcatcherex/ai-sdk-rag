'use client';

import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Images, Loader2, Tag, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { ToolPageProps } from '@/features/tools/registry/page-loaders';

type Photo = {
  id: string;
  url: string;
  filename: string | null;
  tags: string[];
  usageCount: number;
  createdAt: string;
};

export function BrandPhotosToolPage({ manifest }: ToolPageProps) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tagInput, setTagInput] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ photos: Photo[] }>({
    queryKey: ['brand-photos'],
    queryFn: () => fetch('/api/brand-photos').then((r) => r.json()),
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
          if (tags.length) fd.append('tags', tags.join(','));
          return fetch('/api/brand-photos', { method: 'POST', body: fd }).then((r) => {
            if (!r.ok) return r.text().then((t) => { throw new Error(t); });
          });
        }),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand-photos'] });
      setTagInput('');
      if (fileRef.current) fileRef.current.value = '';
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch('/api/brand-photos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }).then((r) => { if (!r.ok) throw new Error('Delete failed'); }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand-photos'] }),
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Images className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-semibold">{manifest.title}</h1>
          <p className="text-sm text-muted-foreground">{manifest.description}</p>
        </div>
      </div>

      {/* Upload area */}
      <div className="rounded-xl border border-dashed bg-muted/30 p-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tags: e.g. summer-camp, math-course (comma separated)"
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {uploadMutation.isPending ? 'Uploading…' : 'Upload Photos'}
            </Button>
            <span className="text-xs text-muted-foreground">
              JPEG, PNG, WebP · up to 10 MB each · multiple OK
            </span>
          </div>
          {uploadMutation.isError && (
            <p className="text-xs text-destructive">{(uploadMutation.error as Error).message}</p>
          )}
        </div>
      </div>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveFilter(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !activeFilter
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            All ({photos.length})
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveFilter(activeFilter === tag ? null : tag)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeFilter === tag
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
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
        <div className="flex flex-col items-center gap-2 rounded-xl border bg-muted/20 py-12 text-center">
          <Images className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {activeFilter ? `No photos tagged "${activeFilter}"` : 'No photos yet — upload some above'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {visible.map((photo) => (
            <div key={photo.id} className="group relative rounded-lg overflow-hidden border bg-muted/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.filename ?? 'Brand photo'}
                className="aspect-square w-full object-cover"
              />
              {/* Overlay */}
              <div className="absolute inset-0 flex flex-col justify-between p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                <button
                  onClick={() => deleteMutation.mutate(photo.id)}
                  disabled={deleteMutation.isPending}
                  className="self-end rounded-md bg-destructive/90 p-1.5 text-white hover:bg-destructive"
                  title="Remove photo"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
                <div className="flex flex-col gap-1">
                  {photo.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {photo.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <span className="text-[10px] text-white/70">
                    Used {photo.usageCount}×
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
