'use client';

import Image from 'next/image';
import { Suspense, useRef, useState, useEffect } from 'react';
import { ImageIcon, Loader2, BarChart2, Globe, X, Plus, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { ToolManifest } from '@/features/tools/registry/types';
import { useImageGenerator, type Mode } from '../hooks/use-image-generator';
import { ResultPanel } from './result-panel';
import { ImageCountStepper } from '../ui/image-count-stepper';
import { CompactAspectRatioSelect } from '../ui/compact-aspect-ratio-select';
import { CompactResolutionSelect } from '../ui/compact-resolution-select';
import { ProviderIcon } from '../ui/provider-icon';
import { TemplateStrip, type TemplateItem } from '@/components/ui/template-strip';
import type { BaseModelConfig } from '../types';

interface ImageTemplate extends TemplateItem {
  prompt: string;
  modelId: string;
  aspectRatio: string;
}

const IMAGE_TEMPLATES: ImageTemplate[] = [
  {
    id: 'hero-banner',
    title: 'Hero Banner',
    tag: '16:9 · Landing page',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #0ea5e9 100%)',
    prompt: 'A bold, modern SaaS landing page hero image — abstract glowing geometric shapes on a deep navy background, soft light gradients, minimal and professional, ample empty space for headline text overlay',
    modelId: 'nano-banana-2',
    aspectRatio: '16:9',
  },
  {
    id: 'social-post',
    title: 'Social Post',
    tag: '1:1 · Instagram / Facebook',
    gradient: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
    prompt: 'Eye-catching square social media post visual — vibrant lifestyle scene with bold color palette, Instagram aesthetic, clean composition with visual breathing room for caption overlay',
    modelId: 'nano-banana-2',
    aspectRatio: '1:1',
  },
  {
    id: 'story-reel',
    title: 'Story / Reel',
    tag: '9:16 · Instagram / TikTok',
    gradient: 'linear-gradient(180deg, #a855f7 0%, #ec4899 60%, #f97316 100%)',
    prompt: 'Vertical social media story visual — dynamic composition filling the full frame, bold visual hook at top, modern Gen-Z aesthetic with vibrant colors and strong contrast, space for text at top and bottom',
    modelId: 'nano-banana-2',
    aspectRatio: '9:16',
  },
  {
    id: 'product-ad',
    title: 'Product Ad',
    tag: '1:1 · E-commerce',
    gradient: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #7dd3fc 100%)',
    prompt: 'Premium e-commerce product advertisement — isolated product centred on a clean gradient background, soft studio lighting with subtle shadow, sharp details, white space on sides for price and CTA overlay',
    modelId: 'nano-banana-2',
    aspectRatio: '1:1',
  },
  {
    id: 'blog-cover',
    title: 'Blog Cover',
    tag: '4:3 · Editorial',
    gradient: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
    prompt: 'Editorial blog post cover — stylised concept illustration representing technology and creativity, modern flat-art style with teal and cyan tones, clean and professional, suitable for a tech or business blog header',
    modelId: 'nano-banana-2',
    aspectRatio: '4:3',
  },
  {
    id: 'email-header',
    title: 'Email Header',
    tag: '4:1 · Newsletter',
    gradient: 'linear-gradient(90deg, #1e293b 0%, #334155 60%, #0f172a 100%)',
    prompt: 'Wide email newsletter header banner — elegant abstract dark background with subtle geometric texture, a single warm accent light, minimal and premium brand feel, plenty of horizontal space for logo and tagline',
    modelId: 'nano-banana-2',
    aspectRatio: '4:1',
  },
  {
    id: 'linkedin-post',
    title: 'LinkedIn Post',
    tag: '16:9 · Professional',
    gradient: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
    prompt: 'Professional LinkedIn post image — clean corporate visual with a confident business theme, blue tones, abstract data or network motif, polished and trustworthy, whitespace for quote or stat overlay',
    modelId: 'nano-banana-2',
    aspectRatio: '16:9',
  },
  {
    id: 'sale-banner',
    title: 'Sale Banner',
    tag: '16:9 · Promotion',
    gradient: 'linear-gradient(135deg, #dc2626 0%, #ea580c 50%, #facc15 100%)',
    prompt: 'High-energy promotional sale banner — bold red-to-gold gradient with dynamic diagonal shapes, confetti or ribbon accents, retail campaign aesthetic, large central area for discount percentage and CTA text',
    modelId: 'nano-banana-2',
    aspectRatio: '16:9',
  },
];

/* ── Inline model selector for the composer toolbar ───────────────────────── */

interface InlineModelSelectorProps {
  models: BaseModelConfig[];
  selectedId: string;
  onSelect: (id: string) => void;
}

function InlineModelSelector({ models, selectedId, onSelect }: InlineModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = models.find(m => m.id === selectedId) ?? models[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-foreground/40',
          open ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground',
        )}
      >
        <ProviderIcon provider={selected?.provider ?? ''} className="size-3.5" />
        <span>{selected?.name}</span>
        {selected?.badge && (
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary leading-none">
            {selected.badge}
          </span>
        )}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute bottom-full mb-1.5 left-0 z-50 w-64 rounded-lg border bg-popover shadow-lg py-1">
          {models.map(cfg => (
            <button
              key={cfg.id}
              onClick={() => { onSelect(cfg.id); setOpen(false); }}
              className={cn(
                'w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-muted transition-colors',
                cfg.id === selectedId ? 'bg-muted' : '',
              )}
            >
              <ProviderIcon provider={cfg.provider} className="size-3.5 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium">{cfg.name}</span>
                  {cfg.badge && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary leading-none">
                      {cfg.badge}
                    </span>
                  )}
                </div>
                {cfg.description && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{cfg.description}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────────── */

type Props = { manifest: ToolManifest };

function ImageToolPageInner({ manifest }: Props) {
  const {
    mode, setMode,
    prompt, setPrompt,
    aspectRatio, setAspectRatio,
    quality, setQuality,
    enablePro, setEnablePro,
    resolution, setResolution,
    imageCount, setImageCount,
    googleSearch, setGoogleSearch,
    seed, setSeed,
    imageUrls, setImageUrls,
    modelConfig,
    visibleModels,
    canGenerate,
    isPolling,
    handleModelSelect,
    handleGenerate,
    pollState,
    resetPoll,
  } = useImageGenerator();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const showImageUpload = mode === 'edit' || modelConfig?.mode === 'both';

  const handleAddImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const result = ev.target?.result;
      if (typeof result === 'string') {
        setImageUrls(prev => [...prev, result]);
      }
    };
    reader.readAsDataURL(file);
    // Reset so the same file can be re-added if removed
    e.target.value = '';
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{manifest.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{manifest.description}</p>
        </div>
        <div className="flex rounded-lg border p-0.5 bg-muted/30">
          {(['generate', 'edit'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors',
                mode === m
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m === 'generate' ? 'Generate' : 'Edit Image'}
            </button>
          ))}
        </div>
      </div>

      {/* Result area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
        <Label className="text-sm font-medium">Result</Label>
        <ResultPanel
          state={pollState}
          mode={mode}
          onRetry={resetPoll}
          onNewImage={() => { resetPoll(); setPrompt(''); }}
          onUseAsReference={url => { setImageUrls([url]); setMode('edit'); }}
        />
      </div>

      {/* Bottom composer */}
      <div className="border-t px-4 pb-4 pt-3 bg-background">
        {/* Template strip (collapsible) */}
        {showTemplates && (
          <div className="mb-3">
            <TemplateStrip
              templates={IMAGE_TEMPLATES}
              onSelect={id => {
                const t = IMAGE_TEMPLATES.find(x => x.id === id);
                if (!t) return;
                setPrompt(t.prompt);
                handleModelSelect(t.modelId);
                setAspectRatio(t.aspectRatio);
                setShowTemplates(false);
              }}
            />
          </div>
        )}

        <div className="rounded-xl border bg-background shadow-sm">
          {/* Attachment row — shown in edit mode or when images are uploaded */}
          {(showImageUpload || imageUrls.length > 0) && (
            <div className="flex items-center gap-2 px-3 pt-3">
              {imageUrls.map((url, i) => (
                <div key={i} className="relative group shrink-0">
                  <div className="relative h-12 w-12 overflow-hidden rounded-lg border">
                    <Image
                      src={url}
                      alt="Reference image"
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <button
                    onClick={() => setImageUrls(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
              >
                <ImageIcon className="h-4 w-4" />
                <span className="text-[10px]">Add</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAddImage}
              />
            </div>
          )}

          {/* Prompt textarea */}
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Ask anything"
            disabled={isPolling}
            rows={2}
            className="w-full resize-none bg-transparent px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canGenerate && !isPolling) {
                e.preventDefault();
                handleGenerate();
              }
            }}
          />

          {/* Toolbar */}
          <div className="flex items-center gap-1.5 px-3 pb-3 flex-wrap">
            {/* Templates toggle */}
            <button
              onClick={() => setShowTemplates(v => !v)}
              title="Templates"
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                showTemplates
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              <BarChart2 className="h-4 w-4" />
            </button>

            <div className="w-px h-4 bg-border mx-0.5" />

            {/* Model selector */}
            <InlineModelSelector
              models={visibleModels}
              selectedId={modelConfig?.id ?? ''}
              onSelect={handleModelSelect}
            />

            <div className="w-px h-4 bg-border mx-0.5" />

            {/* Image count */}
            <ImageCountStepper value={imageCount} onChange={setImageCount} />

            <div className="w-px h-4 bg-border mx-0.5" />

            {/* Aspect ratio */}
            {modelConfig && (
              <CompactAspectRatioSelect
                ratios={modelConfig.aspectRatios}
                value={aspectRatio}
                onChange={setAspectRatio}
              />
            )}

            {/* Resolution */}
            {modelConfig?.hasResolution && (
              <CompactResolutionSelect value={resolution} onChange={setResolution} />
            )}

            {/* Google search grounding */}
            {modelConfig?.hasGoogleSearch && (
              <button
                onClick={() => setGoogleSearch(!googleSearch)}
                title={googleSearch ? 'Google Search: on' : 'Google Search: off'}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                  googleSearch
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                <Globe className="h-4 w-4" />
              </button>
            )}

            {modelConfig?.hasEnablePro && (
              <>
                <div className="w-px h-4 bg-border mx-0.5" />
                <div className="flex items-center gap-2 rounded-md border px-2 py-1">
                  <Label htmlFor="enable-pro-toolbar" className="text-xs text-muted-foreground">
                    Pro
                  </Label>
                  <Switch
                    id="enable-pro-toolbar"
                    size="sm"
                    checked={enablePro}
                    onCheckedChange={setEnablePro}
                  />
                </div>
              </>
            )}

            <div className="flex-1" />

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              disabled={isPolling || !canGenerate}
              size="sm"
              className="gap-1.5"
            >
              {isPolling ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <ImageIcon className="h-3.5 w-3.5" />
                  {mode === 'edit' ? 'Edit Image' : 'Generate'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ImageToolPage({ manifest }: Props) {
  return (
    <Suspense>
      <ImageToolPageInner manifest={manifest} />
    </Suspense>
  );
}
