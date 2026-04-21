'use client';

import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BookMarked, ImageIcon, Loader2, Pencil, Save, Sparkles, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ToolPageProps } from '@/features/tools/registry/page-loaders';
import type { BrandProfileOutput } from '../types';
import { parseStyleUrls } from '../utils';

// ── Platform options ──────────────────────────────────────────────────────────

const PLATFORM_OPTIONS = [
  { value: 'line_oa',   label: 'LINE OA'   },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook',  label: 'Facebook'  },
  { value: 'tiktok',    label: 'TikTok'    },
  { value: 'shopee',    label: 'Shopee'    },
  { value: 'website',   label: 'Website'   },
];

// ── Field metadata ────────────────────────────────────────────────────────────

type FieldType = 'textarea' | 'platforms' | 'logo-upload';
type FieldMeta = {
  label: string;
  placeholder: string;
  required: boolean;
  wide?: boolean;
  rows?: number;
  type?: FieldType;
};

const FIELD_META: Record<string, FieldMeta> = {
  brand_name:           { label: 'Brand Name',           placeholder: 'e.g. Leather Co',                                   required: false },
  products:             { label: 'Products / Services',   placeholder: 'e.g. handmade leather bags, wallets',               required: true,  wide: true },
  tone:                 { label: 'Brand Tone',            placeholder: 'e.g. warm, personal, not corporate',                required: true  },
  target_audience:      { label: 'Target Audience',       placeholder: 'e.g. women 25–40, Bangkok',                         required: false },
  price_range:          { label: 'Price Range',           placeholder: 'e.g. 800–2,500 THB',                                required: false },
  usp:                  { label: 'USP',                   placeholder: 'e.g. handmade, limited edition',                    required: false },
  brand_voice_examples: { label: 'Voice Examples',        placeholder: 'Paste 2–3 captions or messages you like…',          required: false, wide: true, rows: 4 },
  do_not_say:           { label: 'Do Not Say',            placeholder: 'e.g. ลดราคาแรง, luxury, cheap',                   required: false, wide: true, rows: 3 },
  promotion_style:      { label: 'Promotion Style',       placeholder: 'e.g. bundle, festival promo, free shipping',        required: false },
  keywords:             { label: 'Keywords / Hashtags',   placeholder: 'e.g. #หนังแท้ #กระเป๋าทำมือ',                    required: false, wide: true },
  competitors:          { label: 'Competitors',           placeholder: 'e.g. Brand A, Brand B',                             required: false },
  customer_pain_points: { label: 'Customer Pain Points',  placeholder: 'e.g. fear of fake leather, want gifts under 1,500', required: false, wide: true, rows: 3 },
  platforms:            { label: 'Platforms',             placeholder: '',                                                   required: false, wide: true, type: 'platforms' },
  visual_style:         { label: 'Visual Style',          placeholder: 'e.g. minimal, warm tones, natural lighting',        required: false },
  color_palette:        { label: 'Color Palette',         placeholder: 'e.g. cream, terracotta, forest green',              required: false },
  logo_url:             { label: 'Brand Logo',            placeholder: '',                                                   required: false, wide: true, type: 'logo-upload' },
};

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS = [
  { value: 'core',      label: 'Core',      fields: ['brand_name', 'products', 'tone', 'target_audience', 'price_range'] },
  { value: 'messaging', label: 'Messaging', fields: ['usp', 'brand_voice_examples', 'do_not_say', 'promotion_style', 'keywords'] },
  { value: 'strategy',  label: 'Strategy',  fields: ['competitors', 'customer_pain_points', 'platforms'] },
  { value: 'visuals',   label: 'Visuals',   fields: ['visual_style', 'color_palette', 'logo_url'] },
];

// All fields that count toward the progress ring
const PROGRESS_FIELDS = [
  ...TABS.flatMap(t => t.fields),
  'style_reference_urls',
];

// ── Progress ring ─────────────────────────────────────────────────────────────

function ProgressRing({ pct }: { pct: number }) {
  const r = 15;
  const circ = 2 * Math.PI * r;
  const filled = (pct / 100) * circ;
  const done = pct === 100;
  return (
    <div className="relative flex items-center justify-center w-10 h-10 shrink-0">
      <svg width="40" height="40" className="-rotate-90 absolute inset-0">
        <circle cx="20" cy="20" r={r} fill="none" strokeWidth="3" className="stroke-muted/40" />
        <circle
          cx="20" cy="20" r={r} fill="none" strokeWidth="3"
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
          className={done ? 'stroke-green-500' : 'stroke-primary'}
        />
      </svg>
      <span className={`text-[10px] font-bold tabular-nums ${done ? 'text-green-600' : 'text-primary'}`}>
        {pct}%
      </span>
    </div>
  );
}

// ── Tab dot (completion indicator) ───────────────────────────────────────────

function TabDot({ filled, total }: { filled: number; total: number }) {
  const cls =
    filled === 0 ? 'bg-muted-foreground/30' :
    filled === total ? 'bg-green-500' :
    'bg-amber-400';
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${cls}`} />;
}

// ── Main component ────────────────────────────────────────────────────────────

export function BrandProfileToolPage({ manifest }: ToolPageProps) {
  const queryClient = useQueryClient();
  const styleFileRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [uploadingStyle, setUploadingStyle] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [removingUrl, setRemovingUrl] = useState<string | null>(null);

  const { data, isLoading } = useQuery<BrandProfileOutput>({
    queryKey: ['brand-profile'],
    queryFn: async () => {
      const res = await fetch('/api/tools/brand-profile/profile');
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<BrandProfileOutput>;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: string }) => {
      const res = await fetch('/api/tools/brand-profile/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-profile'] });
      setEditing(null);
    },
  });

  const uploadFile = async (
    file: File,
    endpoint: string,
    field: string,
    setLoading: (v: boolean) => void,
    inputRef?: React.RefObject<HTMLInputElement | null>,
  ) => {
    setLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(endpoint, { method: 'POST', body: form });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json() as { url: string };
      await saveMutation.mutateAsync({ field, value: url });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
      if (inputRef?.current) inputRef.current.value = '';
    }
  };

  const handleStylePaste = (e: React.ClipboardEvent) => {
    const imageFile = Array.from(e.clipboardData.items)
      .find(item => item.type.startsWith('image/'))
      ?.getAsFile();
    if (!imageFile) return;
    e.preventDefault();
    uploadFile(imageFile, '/api/tools/brand-profile/style-image', 'style_reference_url', setUploadingStyle);
  };

  const handleRemoveStyleImage = async (url: string) => {
    setRemovingUrl(url);
    try {
      const res = await fetch('/api/tools/brand-profile/style-image', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error(await res.text());
      queryClient.invalidateQueries({ queryKey: ['brand-profile'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setRemovingUrl(null);
    }
  };

  const handleExtractStyle = async () => {
    setExtracting(true);
    try {
      const res = await fetch('/api/tools/brand-profile/extract-style', { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      queryClient.invalidateQueries({ queryKey: ['brand-profile'] });
    } finally {
      setExtracting(false);
    }
  };

  const startEdit = (field: string, current?: string) => {
    setDraft(current ?? '');
    setEditing(field);
  };

  const togglePlatform = (platform: string, currentValue: string | undefined) => {
    const active = new Set((currentValue ?? '').split(',').map(s => s.trim()).filter(Boolean));
    if (active.has(platform)) active.delete(platform);
    else active.add(platform);
    saveMutation.mutate({ field: 'platforms', value: Array.from(active).join(',') || ' ' });
  };

  if (isLoading) {
    return <div className="p-8 text-muted-foreground text-sm">Loading brand profile…</div>;
  }

  const fields = data?.fields ?? {};
  const styleUrls = parseStyleUrls(fields);
  const filledCount = PROGRESS_FIELDS.filter(f =>
    f === 'style_reference_urls' ? styleUrls.length > 0 : fields[f]?.trim(),
  ).length;
  const pct = Math.round((filledCount / PROGRESS_FIELDS.length) * 100);
  const styleMode = (fields['style_reference_mode'] ?? 'direct') as 'direct' | 'extracted';
  const styleDescription = fields['style_description'];

  // ── Field renderers ──

  const renderField = (fieldKey: string) => {
    const meta = FIELD_META[fieldKey];
    if (!meta) return null;
    const value = fields[fieldKey];
    const isEditing = editing === fieldKey;
    const colClass = meta.wide ? 'col-span-2' : 'col-span-1';

    // Platforms chip selector
    if (meta.type === 'platforms') {
      const activePlatforms = new Set(
        (value ?? '').split(',').map(s => s.trim()).filter(Boolean),
      );
      return (
        <div key={fieldKey} className={`${colClass} rounded-xl border bg-card p-3 space-y-2`}>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{meta.label}</span>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORM_OPTIONS.map(p => (
              <button
                key={p.value}
                disabled={saveMutation.isPending}
                onClick={() => togglePlatform(p.value, value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  activePlatforms.has(p.value)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-foreground/50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Logo upload
    if (meta.type === 'logo-upload') {
      return (
        <div key={fieldKey} className={`${colClass} rounded-xl border bg-card p-3 space-y-2`}>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{meta.label}</span>
          <div className="flex items-center gap-3">
            {value && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt="Logo" className="h-10 w-10 object-contain rounded border bg-white p-0.5 shrink-0" />
            )}
            <input
              ref={logoFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file, '/api/tools/brand-profile/logo', 'logo_url', setUploadingLogo, logoFileRef);
              }}
            />
            <Button variant="outline" size="sm" disabled={uploadingLogo} onClick={() => logoFileRef.current?.click()}>
              {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              {value ? 'Replace' : 'Upload Logo'}
            </Button>
          </div>
        </div>
      );
    }

    // Standard textarea field
    return (
      <div key={fieldKey} className={`${colClass} rounded-xl border bg-card p-3 group`}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            {meta.label}
            {meta.required && <span className="text-destructive">*</span>}
          </span>
          {!isEditing && (
            <Button
              variant="ghost" size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => startEdit(fieldKey, value)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={meta.placeholder}
              rows={meta.rows ?? 2}
              className="resize-none text-sm"
              autoFocus
            />
            <div className="flex gap-1.5 justify-end">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditing(null)}>
                <X className="h-3 w-3 mr-1" />Cancel
              </Button>
              <Button
                size="sm" className="h-7 text-xs"
                disabled={!draft.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate({ field: fieldKey, value: draft.trim() })}
              >
                <Save className="h-3 w-3 mr-1" />Save
              </Button>
            </div>
          </div>
        ) : (
          <p
            className={`text-sm leading-relaxed whitespace-pre-wrap cursor-pointer rounded px-1 -mx-1 hover:bg-muted/50 transition-colors ${
              value ? 'text-foreground' : 'text-muted-foreground/60 italic'
            }`}
            onClick={() => startEdit(fieldKey, value)}
          >
            {value ?? meta.placeholder}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <BookMarked className="h-5 w-5" />
            {manifest.title}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">{manifest.description}</p>
        </div>
        <ProgressRing pct={pct} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="core">
        <TabsList className="w-full justify-start">
          {TABS.map(tab => {
            const tabFilled = tab.fields.filter(f => fields[f]?.trim()).length;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                {tab.label}
                <TabDot filled={tabFilled} total={tab.fields.length} />
              </TabsTrigger>
            );
          })}
          <TabsTrigger value="style" className="gap-2">
            Style
            <TabDot filled={styleUrls.length > 0 ? 1 : 0} total={1} />
          </TabsTrigger>
        </TabsList>

        {/* Core / Messaging / Strategy / Visuals tabs */}
        {TABS.map(tab => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            <div className="grid grid-cols-2 gap-3">
              {tab.fields.map(renderField)}
            </div>
          </TabsContent>
        ))}

        {/* Style Reference tab */}
        <TabsContent value="style" className="mt-4 space-y-4" onPaste={handleStylePaste}>
          {/* Image grid */}
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                Reference Images
                {styleUrls.length > 0 && (
                  <span className="text-xs text-muted-foreground font-normal">({styleUrls.length})</span>
                )}
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  ref={styleFileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => {
                    const files = Array.from(e.target.files ?? []);
                    files.forEach(file => uploadFile(file, '/api/tools/brand-profile/style-image', 'style_reference_urls', setUploadingStyle, styleFileRef));
                  }}
                />
                <Button variant="outline" size="sm" disabled={uploadingStyle} onClick={() => styleFileRef.current?.click()}>
                  {uploadingStyle ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                  Add
                </Button>
              </div>
            </div>

            {styleUrls.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Upload or paste (Ctrl+V) sample images (Instagram posts, ad creatives, etc.) to guide AI media generation style.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {styleUrls.map((url) => (
                  <div key={url} className="group relative rounded-lg overflow-hidden border aspect-video bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="Style reference" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      disabled={removingUrl === url}
                      onClick={() => handleRemoveStyleImage(url)}
                      className="absolute top-1 right-1 flex items-center justify-center h-6 w-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 disabled:opacity-50"
                      aria-label="Remove"
                    >
                      {removingUrl === url
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <X className="h-3 w-3" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agent usage settings — shown only when images exist */}
          {styleUrls.length > 0 && (
            <div className="rounded-xl border bg-card p-4 space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">How agents use these images</p>
                <div className="flex gap-2">
                  <Button
                    variant={styleMode === 'direct' ? 'default' : 'outline'}
                    size="sm" className="flex-1 text-xs"
                    onClick={() => saveMutation.mutate({ field: 'style_reference_mode', value: 'direct' })}
                  >
                    Direct Reference
                  </Button>
                  <Button
                    variant={styleMode === 'extracted' ? 'default' : 'outline'}
                    size="sm" className="flex-1 text-xs"
                    onClick={() => saveMutation.mutate({ field: 'style_reference_mode', value: 'extracted' })}
                  >
                    Extract Description
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {styleMode === 'direct'
                    ? 'All image URLs passed directly to image generation APIs as style guides.'
                    : 'AI reads the first image and saves a reusable text description — works with any model.'}
                </p>
              </div>

                {styleMode === 'extracted' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium">Extracted Style Description</p>
                      <Button variant="outline" size="sm" className="text-xs" disabled={extracting} onClick={handleExtractStyle}>
                        {extracting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                        {styleDescription ? 'Re-extract' : 'Extract'}
                      </Button>
                    </div>

                    {editing === 'style_description' ? (
                      <div className="space-y-2">
                        <Textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3} className="resize-none text-sm" autoFocus />
                        <div className="flex gap-1.5 justify-end">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditing(null)}>
                            <X className="h-3 w-3 mr-1" />Cancel
                          </Button>
                          <Button
                            size="sm" className="h-7 text-xs"
                            disabled={!draft.trim() || saveMutation.isPending}
                            onClick={() => saveMutation.mutate({ field: 'style_description', value: draft.trim() })}
                          >
                            <Save className="h-3 w-3 mr-1" />Save
                          </Button>
                        </div>
                      </div>
                    ) : styleDescription ? (
                      <div className="relative group/desc">
                        <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3 pr-8 leading-relaxed">{styleDescription}</p>
                        <Button
                          variant="ghost" size="icon"
                          className="h-6 w-6 absolute top-2 right-2 opacity-0 group-hover/desc:opacity-100 transition-opacity"
                          onClick={() => startEdit('style_description', styleDescription)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        Click Extract to analyze the first image and generate a reusable style description.
                      </p>
                    )}
                  </div>
                )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
