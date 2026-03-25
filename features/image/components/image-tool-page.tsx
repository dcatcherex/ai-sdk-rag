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
    id: 'photorealistic',
    title: 'Photorealistic',
    tag: '1:1 · Portrait',
    image: '/templates/images/sample.jpg',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
    prompt: 'A photorealistic portrait of a young woman with green eyes, golden hour lighting, shallow depth of field, 8K',
    modelId: 'nano-banana-2',
    aspectRatio: '1:1',
  },
  {
    id: 'cinematic',
    title: 'Cinematic',
    tag: '16:9 · Dark',
    gradient: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)',
    prompt: 'A cinematic wide shot of a lone figure walking through a misty forest at dawn, moody atmosphere, film grain',
    modelId: 'nano-banana-2',
    aspectRatio: '16:9',
  },
  {
    id: 'anime',
    title: 'Anime Style',
    tag: '9:16 · Illustration',
    gradient: 'linear-gradient(135deg, #f472b6 0%, #7c3aed 100%)',
    prompt: 'Anime style illustration of a magical girl with flowing silver hair standing in a cherry blossom garden, Studio Ghibli inspired',
    modelId: 'nano-banana-2',
    aspectRatio: '9:16',
  },
  {
    id: 'product',
    title: 'Product Shot',
    tag: '1:1 · Clean',
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)',
    prompt: 'Professional product photography of a sleek white perfume bottle on a marble surface, soft studio lighting, white background',
    modelId: 'nano-banana-2',
    aspectRatio: '1:1',
  },
  {
    id: 'scifi',
    title: 'Sci-Fi City',
    tag: '16:9 · Futuristic',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #1e40af 100%)',
    prompt: 'A futuristic megacity skyline at night, flying vehicles, neon signs, rain-soaked streets reflecting holographic billboards, cyberpunk',
    modelId: 'nano-banana-2',
    aspectRatio: '16:9',
  },
  {
    id: 'fantasy',
    title: 'Fantasy Art',
    tag: '4:3 · Epic',
    gradient: 'linear-gradient(135deg, #10b981 0%, #7c3aed 100%)',
    prompt: 'Epic fantasy landscape with a dragon soaring over an ancient castle, dramatic stormy sky, lightning, hyper-detailed digital art',
    modelId: 'nano-banana-2',
    aspectRatio: '4:3',
  },
  {
    id: 'nature',
    title: 'Nature',
    tag: '4:3 · Landscape',
    gradient: 'linear-gradient(135deg, #4ade80 0%, #065f46 100%)',
    prompt: 'A breathtaking mountain landscape with snow-capped peaks, crystal clear lake reflection, golden sunrise light rays',
    modelId: 'nano-banana-2',
    aspectRatio: '4:3',
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
