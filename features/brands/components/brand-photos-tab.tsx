'use client';

import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Images, Loader2, Pencil, Tag, Trash2, Upload, UploadCloudIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Photo = {
  id: string;
  url: string;
  filename: string | null;
  tags: string[];
  usageCount: number;
};

type SelectionEvent = Pick<React.MouseEvent | React.KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'>;

const EDLAB_ESSENTIAL_TAGS = [
  'group',
  'or',
  'cpr',
  'lab',
  'er',
  'hands-on',
  'microscope',
  'round-latest',
];

function parseTags(value: string) {
  return [...new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))];
}

function formatTags(tags: string[]) {
  return tags.join(', ');
}

function toggleTagValue(value: string, tag: string) {
  const tags = parseTags(value);
  return tags.includes(tag)
    ? formatTags(tags.filter((current) => current !== tag))
    : formatTags([...tags, tag]);
}

export function BrandPhotosTab({ brandId }: { brandId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tagInput, setTagInput] = useState('');
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [editTagInput, setEditTagInput] = useState('');
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(() => new Set());
  const [lastSelectedPhotoId, setLastSelectedPhotoId] = useState<string | null>(null);
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
  const selectedPhotos = photos.filter((photo) => selectedPhotoIds.has(photo.id));
  const untaggedPhotos = photos.filter((photo) => photo.tags.length === 0);

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const tags = parseTags(tagInput);
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

  const updateTagsMutation = useMutation({
    mutationFn: async ({ id, tags }: { id: string; tags: string[] }) => {
      const res = await fetch('/api/brand-photos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, brandId, tags }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand-photos', brandId] });
      setEditingPhoto(null);
      setEditTagInput('');
    },
  });

  const applyBulkTagsMutation = useMutation({
    mutationFn: async (tagsToAdd: string[]) => {
      await Promise.all(
        selectedPhotos.map((photo) => {
          const tags = [...new Set([...photo.tags, ...tagsToAdd])];
          return fetch('/api/brand-photos', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: photo.id, brandId, tags }),
          }).then((res) => {
            if (!res.ok) return res.text().then((message) => { throw new Error(message); });
          });
        }),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand-photos', brandId] });
      setBulkTagInput('');
      setSelectedPhotoIds(new Set());
      setLastSelectedPhotoId(null);
    },
  });

  const openTagEditor = (photo: Photo) => {
    setEditingPhoto(photo);
    setEditTagInput(formatTags(photo.tags));
  };

  const handlePhotoSelect = (photo: Photo, event: SelectionEvent) => {
    setSelectedPhotoIds((current) => {
      const next = new Set(current);

      if (event.shiftKey && lastSelectedPhotoId) {
        const start = visible.findIndex((item) => item.id === lastSelectedPhotoId);
        const end = visible.findIndex((item) => item.id === photo.id);
        if (start !== -1 && end !== -1) {
          const [from, to] = start < end ? [start, end] : [end, start];
          visible.slice(from, to + 1).forEach((item) => next.add(item.id));
        } else {
          next.add(photo.id);
        }
        return next;
      }

      if (event.ctrlKey || event.metaKey) {
        if (next.has(photo.id)) {
          next.delete(photo.id);
        } else {
          next.add(photo.id);
        }
        return next;
      }

      return new Set([photo.id]);
    });
    setLastSelectedPhotoId(photo.id);
  };

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
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['brand-photos', brandId] });
      setSelectedPhotoIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    },
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
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">EdLab preset</span>
          {EDLAB_ESSENTIAL_TAGS.map((tag) => {
            const active = parseTags(tagInput).includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setTagInput((value) => toggleTagValue(value, tag))}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                {tag}
              </button>
            );
          })}
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
      {(allTags.length > 0 || untaggedPhotos.length > 0) && (
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
          {untaggedPhotos.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectedPhotoIds(new Set(untaggedPhotos.map((photo) => photo.id)));
                setLastSelectedPhotoId(untaggedPhotos[untaggedPhotos.length - 1]?.id ?? null);
              }}
              className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300"
            >
              Select untagged ({untaggedPhotos.length})
            </button>
          )}
        </div>
      )}

      {selectedPhotoIds.size > 0 && (
        <div className="rounded-lg border bg-background/95 p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">
                {selectedPhotoIds.size}
              </span>
              selected
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  value={bulkTagInput}
                  onChange={(event) => setBulkTagInput(event.target.value)}
                  placeholder="Add tags to selected photos"
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {EDLAB_ESSENTIAL_TAGS.map((tag) => {
                  const active = parseTags(bulkTagInput).includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setBulkTagInput((value) => toggleTagValue(value, tag))}
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-muted/40 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedPhotoIds(new Set());
                  setLastSelectedPhotoId(null);
                }}
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Clear
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={applyBulkTagsMutation.isPending || parseTags(bulkTagInput).length === 0}
                onClick={() => applyBulkTagsMutation.mutate(parseTags(bulkTagInput))}
              >
                {applyBulkTagsMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                )}
                Add tags
              </Button>
            </div>
          </div>
          {applyBulkTagsMutation.isError && (
            <p className="mt-2 text-xs text-destructive">{(applyBulkTagsMutation.error as Error).message}</p>
          )}
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
            <div
              key={photo.id}
              role="button"
              tabIndex={0}
              aria-pressed={selectedPhotoIds.has(photo.id)}
              onClick={(event) => handlePhotoSelect(photo, event)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handlePhotoSelect(photo, event);
                }
              }}
              className={cn(
                'group relative overflow-hidden rounded-lg border bg-muted/20 outline-none transition-all',
                selectedPhotoIds.has(photo.id)
                  ? 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-background'
                  : 'hover:border-muted-foreground/40',
              )}
            >
              {photo.tags.length === 0 && (
                <span
                  aria-label="No tags"
                  title="No tags"
                  className="absolute left-2 top-2 z-10 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-zinc-900"
                />
              )}
              {selectedPhotoIds.has(photo.id) && (
                <span className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-white dark:ring-zinc-900">
                  <Check className="h-3 w-3" />
                </span>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.filename ?? 'Brand photo'}
                className="aspect-square w-full object-cover"
              />
              <div className="absolute inset-0 flex flex-col justify-between p-1.5 opacity-0 transition-opacity group-hover:opacity-100 bg-black/40">
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    title="Edit tags"
                    onClick={(event) => {
                      event.stopPropagation();
                      openTagEditor(photo);
                    }}
                    className="rounded bg-white/90 p-1 text-zinc-900 hover:bg-white"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    title="Delete photo"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteMutation.mutate(photo.id);
                    }}
                    disabled={deleteMutation.isPending}
                    className="rounded bg-destructive/90 p-1 text-white hover:bg-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
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

      <Dialog open={Boolean(editingPhoto)} onOpenChange={(open) => {
        if (!open) setEditingPhoto(null);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit photo tags</DialogTitle>
          </DialogHeader>
          {editingPhoto && (
            <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
              <div className="overflow-hidden rounded-lg border bg-muted/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={editingPhoto.url}
                  alt={editingPhoto.filename ?? 'Brand photo'}
                  className="aspect-square w-full object-cover"
                />
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="brand-photo-tags">Tags</Label>
                  <Input
                    id="brand-photo-tags"
                    value={editTagInput}
                    onChange={(e) => setEditTagInput(e.target.value)}
                    placeholder="group, or, round-latest"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {EDLAB_ESSENTIAL_TAGS.map((tag) => {
                    const active = parseTags(editTagInput).includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setEditTagInput((value) => toggleTagValue(value, tag))}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                          active
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
                        )}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
                {updateTagsMutation.isError && (
                  <p className="text-xs text-destructive">{(updateTagsMutation.error as Error).message}</p>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingPhoto(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={updateTagsMutation.isPending}
                    onClick={() => updateTagsMutation.mutate({
                      id: editingPhoto.id,
                      tags: parseTags(editTagInput),
                    })}
                  >
                    {updateTagsMutation.isPending && (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    )}
                    Save tags
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
