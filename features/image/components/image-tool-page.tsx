'use client';

import { Suspense } from 'react';
import { ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ToolManifest } from '@/features/tools/registry/types';
import { useImageGenerator, type Mode } from '../hooks/use-image-generator';
import { PromptSection } from './prompt-section';
import { ModelSelector } from './model-selector';
import { GenerationControls } from './generation-controls';
import { ResultPanel } from './result-panel';
import { ImageUploadZone } from '../ui/image-upload-zone';
import { TemplateStrip, type TemplateItem } from '@/components/ui/template-strip';

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

type Props = { manifest: ToolManifest };

function ImageToolPageInner({ manifest }: Props) {
  const {
    mode, setMode,
    prompt, setPrompt,
    aspectRatio, setAspectRatio,
    quality, setQuality,
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
            <button key={m} onClick={() => setMode(m)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors',
                mode === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}>
              {m === 'generate' ? 'Generate' : 'Edit image'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Template strip — full width above both columns */}
        <div className="border-b px-6 py-4">
          <TemplateStrip
            templates={IMAGE_TEMPLATES}
            onSelect={id => {
              const t = IMAGE_TEMPLATES.find(x => x.id === id);
              if (!t) return;
              setPrompt(t.prompt);
              handleModelSelect(t.modelId);
              setAspectRatio(t.aspectRatio);
            }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 flex-1">
          {/* Left: Controls */}
          <div className="p-6 space-y-6 border-r">
            <PromptSection mode={mode} value={prompt} onChange={setPrompt} disabled={isPolling} />

            <ModelSelector models={visibleModels} selectedId={modelConfig?.id} onSelect={handleModelSelect} />

            {(mode === 'edit' || modelConfig?.mode === 'both') && (
              <ImageUploadZone
                images={imageUrls}
                onAdd={b64 => setImageUrls(prev => [...prev, b64])}
                onRemove={i => setImageUrls(prev => prev.filter((_, idx) => idx !== i))}
                required={modelConfig?.requiresImages}
              />
            )}

            <GenerationControls
              modelConfig={modelConfig}
              aspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
              resolution={resolution}
              onResolutionChange={setResolution}
              imageCount={imageCount}
              onImageCountChange={setImageCount}
              quality={quality}
              onQualityChange={setQuality}
              googleSearch={googleSearch}
              onGoogleSearchChange={setGoogleSearch}
              seed={seed}
              onSeedChange={setSeed}
              disabled={isPolling}
            />

            <Button onClick={handleGenerate} disabled={isPolling || !canGenerate} className="w-full" size="lg">
              {isPolling
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</>
                : <><ImageIcon className="mr-2 h-4 w-4" />{mode === 'edit' ? 'Edit Image' : 'Generate Image'}</>}
            </Button>
          </div>

          {/* Right: Result */}
          <ResultPanel
            state={pollState}
            mode={mode}
            onRetry={resetPoll}
            onNewImage={() => { resetPoll(); setPrompt(''); }}
            onUseAsReference={url => { setImageUrls([url]); setMode('edit'); }}
          />
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
