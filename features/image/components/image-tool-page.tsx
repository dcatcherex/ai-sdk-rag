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

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 h-full">
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
