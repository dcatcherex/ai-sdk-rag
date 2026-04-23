'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  SparklesIcon,
  Trash2,
  UploadIcon,
  WandSparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImageUploadZone } from '@/components/ui/image-upload-zone';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type StockImage = {
  id: string;
  styleTag: string | null;
  aspectRatio: string | null;
  imageUrl: string;
  thumbnailUrl: string | null;
  usedCount: number;
  createdAt: string;
};

type StockStat = { styleTag: string | null; count: number };

type StockPoolResponse = {
  images: StockImage[];
  total: number;
  stats: StockStat[];
};

type GalleryAsset = {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  createdAt: number;
};

// ── Constants ──────────────────────────────────────────────────────────────────

const STYLE_TAGS = ['social_post', 'photorealistic', 'illustration'] as const;

const DEFAULT_PROMPTS: Record<string, string> = {
  social_post:
    'Professional social media post background, clean minimal design, modern layout with space for text, brand neutral, vibrant colors, high quality',
  photorealistic:
    'Professional lifestyle photography, natural lighting, modern setting, high resolution, commercial photography style',
  illustration:
    'Clean modern vector illustration, professional design, minimal style, colorful, suitable for marketing materials',
};

const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:5', '3:2'];

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatsBadges({ stats, total }: { stats: StockStat[]; total: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary">{total} total</Badge>
      {stats.map((s) => (
        <Badge key={s.styleTag ?? 'untagged'} variant="outline">
          {s.styleTag ?? 'untagged'}: {s.count}
        </Badge>
      ))}
    </div>
  );
}

function StockImageCard({
  image,
  onDelete,
  isDeleting,
}: {
  image: StockImage;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border bg-background">
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        <Image
          src={image.thumbnailUrl ?? image.imageUrl}
          alt=""
          fill
          unoptimized
          className="object-cover"
        />
      </div>
      <div className="p-2 space-y-1.5">
        <div className="flex flex-wrap gap-1">
          {image.styleTag && <Badge variant="secondary" className="text-xs">{image.styleTag}</Badge>}
          {image.aspectRatio && <Badge variant="outline" className="text-xs">{image.aspectRatio}</Badge>}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Used {image.usedCount}×</span>
          <Button
            size="icon"
            variant="ghost"
            className="size-6 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(image.id)}
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Gallery picker (Option B) ──────────────────────────────────────────────────

function GalleryPicker() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [styleTag, setStyleTag] = useState<string>('__none__');
  const [aspectRatio, setAspectRatio] = useState<string>('__none__');
  const [feedback, setFeedback] = useState('');

  const { data, isLoading } = useQuery<{ assets: GalleryAsset[] }>({
    queryKey: ['admin', 'gallery-assets'],
    queryFn: async () => {
      const res = await fetch('/api/media-assets?limit=100');
      if (!res.ok) throw new Error('Failed to load gallery');
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async (assets: GalleryAsset[]) => {
      await Promise.all(
        assets.map((a) =>
          fetch('/api/admin/stock-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUrl: a.url,
              thumbnailUrl: a.thumbnailUrl ?? undefined,
              styleTag: styleTag === '__none__' ? undefined : styleTag,
              aspectRatio: aspectRatio === '__none__' ? undefined : aspectRatio,
            }),
          }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'stock-pool'] });
      setSelected(new Set());
      setFeedback(`Added ${selected.size} image${selected.size > 1 ? 's' : ''} to pool.`);
      setTimeout(() => setFeedback(''), 3000);
    },
  });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleAdd = () => {
    const assets = (data?.assets ?? []).filter((a) => selected.has(a.id));
    addMutation.mutate(assets);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading gallery…
      </div>
    );
  }

  const assets = data?.assets ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Style tag</Label>
          <Select value={styleTag} onValueChange={setStyleTag}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="No tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No tag</SelectItem>
              {STYLE_TAGS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Aspect ratio</Label>
          <Select value={aspectRatio} onValueChange={setAspectRatio}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Any</SelectItem>
              {ASPECT_RATIOS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={handleAdd}
          disabled={selected.size === 0 || addMutation.isPending}
          size="sm"
        >
          {addMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Add {selected.size > 0 ? `${selected.size} selected` : 'selected'}
        </Button>
        {feedback && <p className="text-xs text-green-600">{feedback}</p>}
      </div>

      {assets.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No gallery images found.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => toggle(asset.id)}
              className={cn(
                'relative aspect-square overflow-hidden rounded-lg border-2 transition-all',
                selected.has(asset.id)
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'border-transparent hover:border-muted-foreground/40',
              )}
            >
              <Image
                src={asset.thumbnailUrl ?? asset.url}
                alt=""
                fill
                unoptimized
                className="object-cover"
              />
              {selected.has(asset.id) && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                  <div className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <svg className="size-3" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Upload images (Option C) ──────────────────────────────────────────────────

function UploadTab() {
  const queryClient = useQueryClient();
  const [styleTag, setStyleTag] = useState<string>('__none__');
  const [aspectRatio, setAspectRatio] = useState<string>('__none__');
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploadedCount, setUploadedCount] = useState(0);

  const addMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      const res = await fetch('/api/admin/stock-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          styleTag: styleTag === '__none__' ? undefined : styleTag,
          aspectRatio: aspectRatio === '__none__' ? undefined : aspectRatio,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'stock-pool'] });
      setUploadedCount((n) => n + 1);
      setPreviewUrl('');
    },
  });

  const handleUpload = async (file: File): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/admin/stock-images/upload', { method: 'POST', body: form });
    if (!res.ok) {
      const { error } = await res.json() as { error: string };
      throw new Error(error ?? 'Upload failed');
    }
    const { url } = await res.json() as { url: string };
    return url;
  };

  const handleChange = (url: string) => {
    setPreviewUrl(url);
    if (url) void addMutation.mutateAsync(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>Style tag</Label>
          <Select value={styleTag} onValueChange={setStyleTag}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No tag</SelectItem>
              {STYLE_TAGS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Aspect ratio</Label>
          <Select value={aspectRatio} onValueChange={setAspectRatio}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Any</SelectItem>
              {ASPECT_RATIOS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ImageUploadZone
        value={previewUrl}
        onChange={handleChange}
        onUpload={handleUpload}
        label="Upload stock image"
        hint="JPEG, PNG, WebP · max 10 MB · uploads directly to pool"
        disabled={addMutation.isPending}
      />

      {addMutation.isError && (
        <p className="text-sm text-destructive">
          {addMutation.error instanceof Error ? addMutation.error.message : 'Failed to add to pool'}
        </p>
      )}

      {uploadedCount > 0 && (
        <p className="text-sm text-green-600 dark:text-green-400">
          {uploadedCount} image{uploadedCount > 1 ? 's' : ''} added to pool this session.
          Upload another to keep going.
        </p>
      )}
    </div>
  );
}

// ── Batch generate (Option A) ──────────────────────────────────────────────────

function BatchGenerate() {
  const queryClient = useQueryClient();
  const [styleTag, setStyleTag] = useState<string>(STYLE_TAGS[0] as string);
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [count, setCount] = useState(5);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPTS[STYLE_TAGS[0]]!);
  const [result, setResult] = useState<{ started: number; failed: number } | null>(null);

  const handleStyleTagChange = (tag: string) => {
    setStyleTag(tag);
    setPrompt(DEFAULT_PROMPTS[tag] ?? '');
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/stock-images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, styleTag: styleTag === '__none__' ? undefined : styleTag, aspectRatio: aspectRatio === '__none__' ? undefined : aspectRatio, count }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ started: number; failed: number }>;
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['admin', 'stock-pool'] });
    },
  });

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Style tag</Label>
          <Select value={styleTag} onValueChange={handleStyleTagChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No tag</SelectItem>
              {STYLE_TAGS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Aspect ratio</Label>
          <Select value={aspectRatio} onValueChange={setAspectRatio}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Default</SelectItem>
              {ASPECT_RATIOS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Count (1–10)</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(Math.min(10, Math.max(1, Number(e.target.value))))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Prompt</Label>
        <Textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the images to generate for the stock pool…"
        />
        <p className="text-xs text-muted-foreground">
          Images appear in the pool automatically once generation completes (2–3 min each).
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={!prompt.trim() || generateMutation.isPending}
        >
          {generateMutation.isPending
            ? <><Loader2 className="size-4 animate-spin" /> Starting…</>
            : <><WandSparkles className="size-4" /> Generate {count} image{count > 1 ? 's' : ''}</>}
        </Button>
        {result && (
          <p className="text-sm text-muted-foreground">
            {result.started} job{result.started > 1 ? 's' : ''} started
            {result.failed > 0 ? `, ${result.failed} failed` : ''}.
            Images will appear in the pool when ready.
          </p>
        )}
        {generateMutation.isError && (
          <p className="text-sm text-destructive">
            {generateMutation.error instanceof Error ? generateMutation.error.message : 'Error'}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function StockImagesPage() {
  const queryClient = useQueryClient();
  const [filterTag, setFilterTag] = useState<string>('__all__');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useQuery<StockPoolResponse>({
    queryKey: ['admin', 'stock-pool', filterTag],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '200' });
      const activeTag = filterTag === '__all__' ? '' : filterTag;
      if (activeTag && activeTag !== '__untagged__') params.set('styleTag', activeTag);
      const res = await fetch(`/api/admin/stock-images?${params}`);
      if (!res.ok) throw new Error('Failed to load stock pool');
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/stock-images/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
    },
    onMutate: (id) => setDeletingId(id),
    onSettled: () => setDeletingId(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'stock-pool'] }),
  });

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock Image Pool</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pre-generated images served instantly while personalized images generate in the background.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['admin', 'stock-pool'] })}
          disabled={isFetching}
        >
          <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {data && <StatsBadges stats={data.stats} total={data.total} />}

      {/* Add to pool */}
      <Tabs defaultValue="upload">
        <TabsList>
          <TabsTrigger value="upload">
            <UploadIcon className="size-3.5 mr-1.5" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="gallery">
            <ImageIcon className="size-3.5 mr-1.5" />
            From Gallery
          </TabsTrigger>
          <TabsTrigger value="generate">
            <SparklesIcon className="size-3.5 mr-1.5" />
            Generate New
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upload Images</CardTitle>
              <CardDescription>
                Upload your own images directly into the stock pool. Each image is optimized and stored automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UploadTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gallery" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Add from Media Gallery</CardTitle>
              <CardDescription>
                Select existing images from your gallery and tag them for the stock pool. Free — no generation cost.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GalleryPicker />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generate" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Generate New Stock Images</CardTitle>
              <CardDescription>
                Trigger a batch of AI image generations. Each completed image is automatically added to the pool.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BatchGenerate />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Current pool */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">Current Pool</h2>
          <Select value={filterTag} onValueChange={setFilterTag}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="All tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All tags</SelectItem>
              {STYLE_TAGS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              <SelectItem value="__untagged__">Untagged</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading pool…
          </div>
        ) : !data?.images.length ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No stock images yet. Add some from the gallery or generate a batch above.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {data.images.map((img) => (
              <StockImageCard
                key={img.id}
                image={img}
                onDelete={(id) => deleteMutation.mutate(id)}
                isDeleting={deletingId === img.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
