'use client';

import { useRef, useState } from 'react';
import { ImageIcon, Trash2Icon, UploadCloudIcon, UploadIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BRAND_ASSET_KINDS, type BrandAssetKind } from '../types';
import { useBrandAssets, useDeleteBrandAsset, useUploadBrandAsset } from '../hooks/use-brands';

const KIND_LABELS: Record<BrandAssetKind, string> = {
  logo: 'Logo',
  product: 'Product',
  creative: 'Creative',
  document: 'Document',
  font: 'Font',
  other: 'Other',
};

export function AssetsTab({ brandId }: { brandId: string }) {
  const { data: assets = [], isLoading } = useBrandAssets(brandId);
  const uploadMutation = useUploadBrandAsset(brandId);
  const deleteMutation = useDeleteBrandAsset(brandId);

  const [kind, setKind] = useState<BrandAssetKind>('creative');
  const [collection, setCollection] = useState('');
  const [title, setTitle] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', kind);
    fd.append('title', title.trim() || file.name);
    if (collection.trim()) fd.append('collection', collection.trim());
    uploadMutation.mutate(fd, { onSuccess: () => setTitle('') });
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
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const grouped = assets.reduce<Record<string, typeof assets>>((acc, a) => {
    const key = a.collection ?? 'General';
    return { ...acc, [key]: [...(acc[key] ?? []), a] };
  }, {});

  return (
    <div className="space-y-4">
      {/* Upload controls */}
      <div
        className={cn(
          'relative rounded-lg border-2 border-dashed p-3 space-y-3 transition-colors',
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
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Upload asset · drag & drop or choose file
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Kind</Label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as BrandAssetKind)}
              className="mt-1 w-full h-8 rounded-md border border-black/10 dark:border-border bg-transparent px-2 text-sm"
            >
              {BRAND_ASSET_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Collection / Campaign</Label>
            <Input
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
              placeholder="e.g. April Break Campaign"
              className="mt-1 h-8 text-sm"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Title (uses filename if blank)</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Upgrade Your April Break"
            className="mt-1 h-8 text-sm"
          />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf,.ttf,.otf,.woff,.woff2,.svg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
            e.target.value = '';
          }}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          <UploadIcon className="mr-1.5 size-3.5" />
          {uploadMutation.isPending ? 'Uploading…' : 'Choose file'}
        </Button>
      </div>

      {/* Asset list */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading assets…</p>
      ) : assets.length === 0 ? (
        <div className="py-10 text-center">
          <ImageIcon className="mx-auto mb-2 size-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No assets yet. Upload your first file above.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([col, items]) => (
            <div key={col}>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">{col}</p>
              <div className="space-y-1">
                {items.map((a) => (
                  <div
                    key={a.id}
                    className="group flex items-center gap-3 rounded-md border border-black/5 dark:border-border bg-white/40 dark:bg-white/3 px-3 py-2"
                  >
                    {a.mimeType.startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.url} alt={a.title} className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                        {KIND_LABELS[a.kind][0]}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{KIND_LABELS[a.kind]}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(a.id)}
                      disabled={deleteMutation.isPending}
                      className="p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
                      aria-label="Delete asset"
                    >
                      <Trash2Icon className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
