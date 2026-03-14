'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ImageIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { BRAND_ASSET_KINDS, type Brand, type BrandAsset, type BrandAssetKind } from '../types';

// ── Chip Input ────────────────────────────────────────────────────────────────

function ChipInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  const add = (raw: string) => {
    const val = raw.trim();
    if (val && !values.includes(val)) onChange([...values, val]);
    setInput('');
  };

  return (
    <div className="flex flex-wrap gap-1.5 p-2 min-h-10 rounded-md border border-black/10 dark:border-border bg-transparent focus-within:ring-1 focus-within:ring-black/20 dark:focus-within:ring-white/20">
      {values.map((v) => (
        <span
          key={v}
          className="flex items-center gap-1 rounded-full bg-black/8 dark:bg-white/10 px-2.5 py-0.5 text-sm"
        >
          {v}
          <button
            type="button"
            onClick={() => onChange(values.filter((x) => x !== v))}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Remove ${v}`}
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
            e.preventDefault();
            add(input);
          }
          if (e.key === 'Backspace' && !input && values.length > 0) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={() => { if (input.trim()) add(input); }}
        placeholder={values.length === 0 ? placeholder : ''}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
      />
    </div>
  );
}

// ── Color Field ───────────────────────────────────────────────────────────────

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value || '#6366f1'}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-8 cursor-pointer rounded-md border border-black/10 dark:border-border bg-transparent"
      />
      <div className="flex-1">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#6366f1 or oklch(...)"
          className="h-7 font-mono text-xs"
        />
      </div>
    </div>
  );
}

// ── Assets Tab ────────────────────────────────────────────────────────────────

const KIND_LABELS: Record<BrandAssetKind, string> = {
  logo: 'Logo',
  product: 'Product',
  creative: 'Creative',
  document: 'Document',
  font: 'Font',
  other: 'Other',
};

function AssetsTab({ brandId }: { brandId: string }) {
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<BrandAssetKind>('creative');
  const [collection, setCollection] = useState('');
  const [title, setTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/brands/${brandId}/assets`);
        if (res.ok) setAssets((await res.json()) as BrandAsset[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [brandId]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', kind);
      fd.append('title', title.trim() || file.name);
      if (collection.trim()) fd.append('collection', collection.trim());

      const res = await fetch(`/api/brands/${brandId}/assets`, {
        method: 'POST',
        body: fd,
      });
      if (res.ok) {
        const asset = (await res.json()) as BrandAsset;
        setAssets((prev) => [asset, ...prev]);
        setTitle('');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (assetId: string) => {
    setDeletingId(assetId);
    try {
      await fetch(`/api/brands/${brandId}/assets/${assetId}`, { method: 'DELETE' });
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
    } finally {
      setDeletingId(null);
    }
  };

  // Group by collection
  const grouped = assets.reduce<Record<string, BrandAsset[]>>((acc, a) => {
    const key = a.collection ?? 'General';
    return { ...acc, [key]: [...(acc[key] ?? []), a] };
  }, {});

  return (
    <div className="space-y-4">
      {/* Upload controls */}
      <div className="rounded-lg border border-black/8 dark:border-border p-3 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Upload asset
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
            if (f) void handleUpload(f);
            e.target.value = '';
          }}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <UploadIcon className="mr-1.5 size-3.5" />
          {uploading ? 'Uploading…' : 'Choose file'}
        </Button>
      </div>

      {/* Asset list */}
      {loading ? (
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
                      <img
                        src={a.url}
                        alt={a.title}
                        className="h-10 w-10 rounded object-cover"
                      />
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
                      onClick={() => void handleDelete(a.id)}
                      disabled={deletingId === a.id}
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

// ── Editor Form State ─────────────────────────────────────────────────────────

type FormState = {
  name: string;
  overview: string;
  websiteUrl: string;
  industry: string;
  targetAudience: string;
  toneOfVoice: string[];
  brandValues: string[];
  visualAesthetics: string[];
  fonts: string[];
  colorPrimary: string;
  colorSecondary: string;
  colorAccent: string;
  writingDos: string;
  writingDonts: string;
};

function toForm(b: Brand | null): FormState {
  return {
    name: b?.name ?? '',
    overview: b?.overview ?? '',
    websiteUrl: b?.websiteUrl ?? '',
    industry: b?.industry ?? '',
    targetAudience: b?.targetAudience ?? '',
    toneOfVoice: b?.toneOfVoice ?? [],
    brandValues: b?.brandValues ?? [],
    visualAesthetics: b?.visualAesthetics ?? [],
    fonts: b?.fonts ?? [],
    colorPrimary: b?.colorPrimary ?? '',
    colorSecondary: b?.colorSecondary ?? '',
    colorAccent: b?.colorAccent ?? '',
    writingDos: b?.writingDos ?? '',
    writingDonts: b?.writingDonts ?? '',
  };
}

// ── Main Sheet ────────────────────────────────────────────────────────────────

type Props = {
  brand: Brand | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (brand: Brand) => void;
};

const TABS = [
  { value: 'profile', label: 'Profile' },
  { value: 'voice', label: 'Voice & Values' },
  { value: 'visual', label: 'Visual' },
];

export function BrandEditorSheet({ brand, open, onOpenChange, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(() => toForm(brand));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Sync form when brand prop changes (e.g. switching brands)
  useEffect(() => {
    setForm(toForm(brand));
    setError('');
  }, [brand]);

  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Brand name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const url = brand ? `/api/brands/${brand.id}` : '/api/brands';
      const method = brand ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          overview: form.overview.trim() || null,
          websiteUrl: form.websiteUrl.trim() || null,
          industry: form.industry.trim() || null,
          targetAudience: form.targetAudience.trim() || null,
          colorPrimary: form.colorPrimary || null,
          colorSecondary: form.colorSecondary || null,
          colorAccent: form.colorAccent || null,
          writingDos: form.writingDos.trim() || null,
          writingDonts: form.writingDonts.trim() || null,
        }),
      });
      if (res.ok) {
        const saved = (await res.json()) as Brand;
        onSaved(saved);
        onOpenChange(false);
      } else {
        setError('Failed to save. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const tabs = brand ? [...TABS, { value: 'assets', label: 'Assets' }] : TABS;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
        showCloseButton={false}
      >
        <SheetHeader className="shrink-0 border-b border-black/5 dark:border-border px-6 py-4">
          <SheetTitle className="text-base">
            {brand ? `Edit: ${brand.name}` : 'New Brand'}
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="profile" className="flex flex-1 flex-col overflow-hidden">
          <TabsList className="h-auto shrink-0 justify-start gap-0 rounded-none border-b border-black/5 dark:border-border bg-transparent px-6 py-0">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* Profile */}
            <TabsContent value="profile" className="mt-0 space-y-4">
              <div>
                <Label>Brand Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="e.g. EdLab Experience"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Overview</Label>
                <Textarea
                  value={form.overview}
                  onChange={(e) => set({ overview: e.target.value })}
                  placeholder="What does this brand do and who does it serve?"
                  rows={3}
                  className="mt-1 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Website URL</Label>
                  <Input
                    value={form.websiteUrl}
                    onChange={(e) => set({ websiteUrl: e.target.value })}
                    placeholder="https://example.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Industry</Label>
                  <Input
                    value={form.industry}
                    onChange={(e) => set({ industry: e.target.value })}
                    placeholder="e.g. Education, Retail, Healthcare"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Target Audience</Label>
                <Input
                  value={form.targetAudience}
                  onChange={(e) => set({ targetAudience: e.target.value })}
                  placeholder="e.g. Students aged 12–18 in Thailand"
                  className="mt-1"
                />
              </div>
            </TabsContent>

            {/* Voice & Values */}
            <TabsContent value="voice" className="mt-0 space-y-4">
              <div>
                <Label>Tone of Voice</Label>
                <p className="mb-1.5 text-xs text-muted-foreground">
                  Press Enter or comma to add
                </p>
                <ChipInput
                  values={form.toneOfVoice}
                  onChange={(v) => set({ toneOfVoice: v })}
                  placeholder="Professional, Inspiring, Empowering…"
                />
              </div>
              <div>
                <Label>Brand Values</Label>
                <p className="mb-1.5 text-xs text-muted-foreground">
                  Core values that define this brand
                </p>
                <ChipInput
                  values={form.brandValues}
                  onChange={(v) => set({ brandValues: v })}
                  placeholder="Passion discovery, Real-life experience…"
                />
              </div>
              <div>
                <Label>Writing Guidelines — Do&apos;s</Label>
                <Textarea
                  value={form.writingDos}
                  onChange={(e) => set({ writingDos: e.target.value })}
                  placeholder="e.g. Use active voice, include real-life examples, address the reader directly"
                  rows={3}
                  className="mt-1 resize-none"
                />
              </div>
              <div>
                <Label>Writing Guidelines — Don&apos;ts</Label>
                <Textarea
                  value={form.writingDonts}
                  onChange={(e) => set({ writingDonts: e.target.value })}
                  placeholder="e.g. Avoid jargon, don't use passive voice, no generic corporate phrases"
                  rows={3}
                  className="mt-1 resize-none"
                />
              </div>
            </TabsContent>

            {/* Visual */}
            <TabsContent value="visual" className="mt-0 space-y-4">
              <div>
                <Label>Visual Aesthetics</Label>
                <p className="mb-1.5 text-xs text-muted-foreground">
                  Keywords describing the visual style
                </p>
                <ChipInput
                  values={form.visualAesthetics}
                  onChange={(v) => set({ visualAesthetics: v })}
                  placeholder="professional, minimalist, medical-themed…"
                />
              </div>
              <div>
                <Label>Fonts</Label>
                <ChipInput
                  values={form.fonts}
                  onChange={(v) => set({ fonts: v })}
                  placeholder="Noto Sans Thai, Sarabun…"
                />
              </div>
              <div className="space-y-3">
                <Label>Brand Colors</Label>
                <ColorField
                  label="Primary"
                  value={form.colorPrimary}
                  onChange={(v) => set({ colorPrimary: v })}
                />
                <ColorField
                  label="Secondary"
                  value={form.colorSecondary}
                  onChange={(v) => set({ colorSecondary: v })}
                />
                <ColorField
                  label="Accent"
                  value={form.colorAccent}
                  onChange={(v) => set({ colorAccent: v })}
                />
              </div>
            </TabsContent>

            {/* Assets — only for saved brands */}
            {brand && (
              <TabsContent value="assets" className="mt-0">
                <AssetsTab brandId={brand.id} />
              </TabsContent>
            )}
          </div>
        </Tabs>

        {/* Footer */}
        <div className="flex shrink-0 items-center gap-3 border-t border-black/5 dark:border-border px-6 py-4">
          {error ? (
            <p className="flex-1 text-xs text-destructive">{error}</p>
          ) : (
            <div className="flex-1" />
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : brand ? 'Save changes' : 'Create brand'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
