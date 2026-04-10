'use client';

import { useEffect, useState } from 'react';
import { XIcon } from 'lucide-react';
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
import { type Brand, type BrandColor } from '../types';
import { useAddBrandShare, useBrandShareSearch, useRemoveBrandShare, useSaveBrand } from '../hooks/use-brands';
import { AssetsTab } from './assets-tab';
import { BrandKnowledgeTab } from './brand-knowledge-tab';
import { ChipInput } from './chip-input';
import { ColorPaletteEditor } from './color-palette-editor';
import { StrategyTab } from './strategy-tab';
import { GuardrailEditor } from '@/features/brand-guardrails/components/guardrail-editor';
import { BrandMemoryTab } from '@/features/memory/components/brand-memory-tab';

// ── Form state ────────────────────────────────────────────────────────────────

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
  colors: BrandColor[];
  writingDos: string;
  writingDonts: string;
  positioningStatement: string;
  messagingPillars: string[];
  proofPoints: string[];
  exampleHeadlines: string[];
  exampleRejections: string[];
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
    colors: b?.colors ?? [],
    writingDos: b?.writingDos ?? '',
    writingDonts: b?.writingDonts ?? '',
    positioningStatement: b?.positioningStatement ?? '',
    messagingPillars: b?.messagingPillars ?? [],
    proofPoints: b?.proofPoints ?? [],
    exampleHeadlines: b?.exampleHeadlines ?? [],
    exampleRejections: b?.exampleRejections ?? [],
  };
}

// ── Sharing Tab ───────────────────────────────────────────────────────────────

function SharingTab({ brand }: { brand: Brand }) {
  const [search, setSearch] = useState('');
  const { data: searchResults = [] } = useBrandShareSearch(search);
  const addMutation = useAddBrandShare(brand.id);
  const removeMutation = useRemoveBrandShare(brand.id);

  const currentIds = new Set((brand.sharedWith ?? []).map((u) => u.id));
  const unaddedResults = searchResults.filter((u) => !currentIds.has(u.id));
  const showNoResults = search.trim().length >= 2 && searchResults.length === 0;

  const handleAdd = (userId: string) => {
    addMutation.mutate(userId, { onSuccess: () => setSearch('') });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Share with people</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Team members you add can use this brand in chat but cannot edit or delete it.
        </p>
      </div>

      {/* Current shared users */}
      {(brand.sharedWith ?? []).length > 0 && (
        <div className="space-y-1.5">
          {(brand.sharedWith ?? []).map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between rounded-lg border border-black/5 dark:border-border bg-muted/30 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{u.name}</p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeMutation.mutate(u.id)}
                disabled={removeMutation.isPending}
              >
                <XIcon className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Search to add */}
      <div className="space-y-1.5">
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
        {unaddedResults.length > 0 && (
          <div className="rounded-lg border border-black/5 dark:border-border p-1 space-y-0.5 max-h-40 overflow-y-auto">
            {unaddedResults.map((u) => (
              <button
                key={u.id}
                type="button"
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-muted/60 text-left"
                onClick={() => handleAdd(u.id)}
                disabled={addMutation.isPending}
              >
                <span className="text-sm font-medium">{u.name}</span>
                <span className="text-xs text-muted-foreground">{u.email}</span>
              </button>
            ))}
          </div>
        )}
        {showNoResults && (
          <p className="text-xs text-muted-foreground px-1">
            No registered users found for &ldquo;{search.trim()}&rdquo;.
          </p>
        )}
      </div>

      {(brand.sharedWith ?? []).length === 0 && search.trim().length < 2 && (
        <p className="text-xs text-muted-foreground italic">
          No one has access yet. Search above to invite a team member.
        </p>
      )}
    </div>
  );
}

// ── Sheet ─────────────────────────────────────────────────────────────────────

type Props = {
  brand: Brand | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (brand: Brand) => void;
};

const BASE_TABS = [
  { value: 'profile', label: 'Profile' },
  { value: 'voice', label: 'Voice & Values' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'visual', label: 'Visual' },
  { value: 'guardrails', label: 'Guardrails' },
];

export function BrandEditorSheet({ brand, open, onOpenChange, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(() => toForm(brand));
  const [error, setError] = useState('');
  const saveMutation = useSaveBrand();

  // Sync form when brand prop changes (e.g. switching brands or after import)
  useEffect(() => {
    setForm(toForm(brand));
    setError('');
  }, [brand]);

  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSave = () => {
    if (!form.name.trim()) {
      setError('Brand name is required.');
      return;
    }
    setError('');
    saveMutation.mutate(
      {
        brandId: brand?.id ?? null,
        payload: {
          ...form,
          name: form.name.trim(),
          overview: form.overview.trim() || null,
          websiteUrl: form.websiteUrl.trim() || null,
          industry: form.industry.trim() || null,
          targetAudience: form.targetAudience.trim() || null,
          colors: form.colors.filter((c) => c.hex.trim()),
          writingDos: form.writingDos.trim() || null,
          writingDonts: form.writingDonts.trim() || null,
          positioningStatement: form.positioningStatement.trim() || null,
        },
      },
      {
        onSuccess: (saved) => { onSaved(saved); onOpenChange(false); },
        onError: (err) => setError(err.message),
      },
    );
  };

  const tabs = brand?.isOwner !== false
    ? brand
      ? [...BASE_TABS, { value: 'memory', label: 'Memory' }, { value: 'knowledge', label: 'Knowledge' }, { value: 'assets', label: 'Assets' }, { value: 'sharing', label: 'Sharing' }]
      : BASE_TABS
    : brand
      ? [...BASE_TABS, { value: 'memory', label: 'Memory' }]
      : BASE_TABS;

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

            <TabsContent value="voice" className="mt-0 space-y-4">
              <div>
                <Label>Tone of Voice</Label>
                <p className="mb-1.5 text-xs text-muted-foreground">Press Enter or comma to add</p>
                <ChipInput
                  values={form.toneOfVoice}
                  onChange={(v) => set({ toneOfVoice: v })}
                  placeholder="Professional, Inspiring, Empowering…"
                />
              </div>
              <div>
                <Label>Brand Values</Label>
                <p className="mb-1.5 text-xs text-muted-foreground">Core values that define this brand</p>
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

            <TabsContent value="visual" className="mt-0 space-y-4">
              <div>
                <Label>Visual Aesthetics</Label>
                <p className="mb-1.5 text-xs text-muted-foreground">Keywords describing the visual style</p>
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
              <ColorPaletteEditor colors={form.colors} onChange={(v) => set({ colors: v })} />
            </TabsContent>

            <TabsContent value="strategy" className="mt-0">
              {brand ? (
                <StrategyTab
                  brand={brand}
                  strategyForm={{
                    positioningStatement: form.positioningStatement,
                    messagingPillars: form.messagingPillars,
                    proofPoints: form.proofPoints,
                    exampleHeadlines: form.exampleHeadlines,
                    exampleRejections: form.exampleRejections,
                  }}
                  onStrategyChange={set}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Save the brand first to add strategy.</p>
              )}
            </TabsContent>

            {brand && (
              <TabsContent value="guardrails" className="mt-0">
                <GuardrailEditor brandId={brand.id} />
              </TabsContent>
            )}

            {brand && (
              <TabsContent value="memory" className="mt-0">
                <BrandMemoryTab brandId={brand.id} />
              </TabsContent>
            )}

            {brand && (
              <TabsContent value="knowledge" className="mt-0">
                <BrandKnowledgeTab brandId={brand.id} />
              </TabsContent>
            )}

            {brand && (
              <TabsContent value="assets" className="mt-0">
                <AssetsTab brandId={brand.id} />
              </TabsContent>
            )}

            {brand && brand.isOwner !== false && (
              <TabsContent value="sharing" className="mt-0">
                <SharingTab brand={brand} />
              </TabsContent>
            )}
          </div>
        </Tabs>

        <div className="flex shrink-0 items-center gap-3 border-t border-black/5 dark:border-border px-6 py-4">
          {error ? <p className="flex-1 text-xs text-destructive">{error}</p> : <div className="flex-1" />}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : brand ? 'Save changes' : 'Create brand'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
