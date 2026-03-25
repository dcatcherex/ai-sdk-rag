'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Video, Loader2, CheckCircle2, XCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { ToolManifest } from '@/features/tools/registry/types';
import { useGenerationPoll } from '@/lib/hooks/use-generation-poll';
import { VIDEO_MODEL_CONFIGS, type VideoModelConfig } from '../types';
import { ModelSelector } from '@/features/image/components/model-selector';
import { VideoGenerationControls } from './video-generation-controls';
import { FileUploadZone } from '@/components/ui/file-upload-zone';
import { TemplateStrip, type TemplateItem } from '@/components/ui/template-strip';

interface VideoTemplate extends TemplateItem {
  prompt: string;
  modelId: string;
  aspectRatio: string;
}

const VIDEO_TEMPLATES: VideoTemplate[] = [
  {
    id: 'nature',
    title: 'Nature Scene',
    tag: '16:9 · Timelapse',
    gradient: 'linear-gradient(135deg, #4ade80 0%, #0d9488 100%)',
    prompt: 'Cinematic timelapse of golden clouds rolling over snow-capped mountain peaks at sunrise, dramatic lighting',
    modelId: 'veo3_fast',
    aspectRatio: '16:9',
  },
  {
    id: 'cinematic',
    title: 'Cinematic',
    tag: '16:9 · Drama',
    gradient: 'linear-gradient(135deg, #475569 0%, #0f172a 100%)',
    prompt: 'A lone astronaut walking slowly across a barren red planet, slow motion, dust swirling in the wind, epic scale',
    modelId: 'veo3_fast',
    aspectRatio: '16:9',
  },
  {
    id: 'urban',
    title: 'Urban Street',
    tag: '16:9 · Neon',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #dc2626 100%)',
    prompt: 'Busy Tokyo street at night, neon lights, rain, people with umbrellas, wide angle, cinematic color grade',
    modelId: 'veo3_fast',
    aspectRatio: '16:9',
  },
  {
    id: 'ocean',
    title: 'Ocean Waves',
    tag: '16:9 · Calm',
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #1d4ed8 100%)',
    prompt: 'Calm turquoise ocean waves rolling onto a white sandy beach at sunset, aerial drone shot',
    modelId: 'veo3_fast',
    aspectRatio: '16:9',
  },
  {
    id: 'abstract',
    title: 'Abstract',
    tag: '1:1 · Motion',
    gradient: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
    prompt: 'Abstract fluid simulation, iridescent colors morphing and flowing, hypnotic motion, 4K',
    modelId: 'veo3_fast',
    aspectRatio: '1:1',
  },
  {
    id: 'product',
    title: 'Product Demo',
    tag: '1:1 · Clean',
    gradient: 'linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%)',
    prompt: 'A luxury watch slowly rotating on a reflective surface, studio lighting, product advertisement style',
    modelId: 'veo3_fast',
    aspectRatio: '1:1',
  },
];

type Props = { manifest: ToolManifest };


function VideoToolPageInner({ manifest }: Props) {
  const searchParams = useSearchParams();
  const { state, startPoll, reset } = useGenerationPoll();

  const [modelId, setModelId] = useState('veo3_fast');
  const [prompt, setPrompt] = useState('');
  const [veoMode, setVeoMode] = useState('TEXT_2_VIDEO');
  const [aspectRatio, setAspectRatio] = useState('');
  const [duration, setDuration] = useState('');
  const [quality, setQuality] = useState('');
  const [resolution, setResolution] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  // Resume poll for agent redirect (?id=&taskId=)
  const idFromUrl = searchParams.get('id');
  const taskIdFromUrl = searchParams.get('taskId');
  useEffect(() => {
    if (idFromUrl && taskIdFromUrl && state.status === 'idle') {
      startPoll({ taskId: taskIdFromUrl, generationId: idFromUrl });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idFromUrl, taskIdFromUrl]);

  const modelConfig: VideoModelConfig = VIDEO_MODEL_CONFIGS.find(m => m.id === modelId) ?? VIDEO_MODEL_CONFIGS[0];
  const { videoOptions } = modelConfig;

  // Reset options to defaults when model changes
  useEffect(() => {
    setVeoMode(videoOptions.veoModes?.[0] ?? 'TEXT_2_VIDEO');
    setAspectRatio(videoOptions.aspectRatios?.[0] ?? '');
    setDuration(videoOptions.duration?.[0] ?? '');
    setQuality(videoOptions.quality?.values[0] ?? '');
    setResolution(videoOptions.resolution?.values[0] ?? '');
    setImageUrls([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId]);

  // Derived state
  const isVeo = videoOptions.apiType === 'veo';
  const needsImages =
    videoOptions.inputMode === 'image' ||
    videoOptions.inputMode === 'storyboard' ||
    (isVeo && veoMode !== 'TEXT_2_VIDEO');
  const showImageUpload = needsImages || videoOptions.inputMode === 'both';
  // Force 16:9 for Veo reference mode
  const effectiveAspect = isVeo && veoMode === 'REFERENCE_2_VIDEO' ? '16:9' : aspectRatio;

  const canGenerate =
    (!videoOptions.promptRequired || prompt.trim().length > 0) &&
    (!needsImages || imageUrls.length > 0);

  const isPolling = state.status === 'polling';

  const handleGenerate = async () => {
    if (!canGenerate) return;
    reset();

    const res = await fetch('/api/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        modelId,
        videoSettings: {
          generationMode: veoMode,
          aspectRatio: effectiveAspect || undefined,
          imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
          duration: duration || undefined,
          quality: quality || undefined,
          resolution: resolution || undefined,
        },
      }),
    });

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Request failed' }));
      alert(error ?? 'Request failed');
      return;
    }

    const { taskId, generationId } = await res.json();
    await startPoll({ taskId, generationId, modelId, promptTitle: prompt.substring(0, 50) });
  };

  // Image upload label
  const imageLabel =
    videoOptions.inputMode === 'storyboard'
      ? 'Storyboard panels'
      : isVeo && veoMode === 'FIRST_AND_LAST_FRAMES_2_VIDEO'
        ? 'Frame images (first + optional last)'
        : 'Input image';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">{manifest.title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{manifest.description}</p>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Template strip — full width above both columns */}
        <div className="border-b px-6 py-4">
          <TemplateStrip
            templates={VIDEO_TEMPLATES}
            onSelect={id => {
              const t = VIDEO_TEMPLATES.find(x => x.id === id);
              if (!t) return;
              setPrompt(t.prompt);
              setModelId(t.modelId);
              setAspectRatio(t.aspectRatio);
            }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 flex-1">

          {/* Left: Controls */}
          <div className="p-6 space-y-6 border-r">

            {/* Prompt — hidden for storyboard */}
            {videoOptions.inputMode !== 'storyboard' && (
              <div className="space-y-2">
                <Label htmlFor="prompt">
                  Prompt
                  {!videoOptions.promptRequired && (
                    <span className="ml-1.5 text-xs text-muted-foreground font-normal">(optional)</span>
                  )}
                </Label>
                <Textarea
                  id="prompt"
                  placeholder="Describe the video you want to generate…"
                  rows={4}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  disabled={isPolling}
                />
                {modelConfig.maxPromptLength > 0 && (
                  <p className={`text-xs text-right tabular-nums ${prompt.length > modelConfig.maxPromptLength * 0.8 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                    {prompt.length.toLocaleString()} / {modelConfig.maxPromptLength.toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* Model */}
            <div className={isPolling ? 'pointer-events-none opacity-60' : ''}>
              <ModelSelector
                models={VIDEO_MODEL_CONFIGS}
                selectedId={modelId}
                onSelect={setModelId}
              />
            </div>

            <VideoGenerationControls
              videoOptions={videoOptions}
              aspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
              veoMode={veoMode}
              onVeoModeChange={setVeoMode}
              duration={duration}
              onDurationChange={setDuration}
              quality={quality}
              onQualityChange={setQuality}
              resolution={resolution}
              onResolutionChange={setResolution}
              disabled={isPolling}
            />

            {/* Image upload */}
            {showImageUpload && (
              <FileUploadZone
                files={imageUrls}
                onAdd={b64 => setImageUrls(prev => [...prev, b64])}
                onRemove={i => setImageUrls(prev => prev.filter((_, idx) => idx !== i))}
                label={imageLabel}
                accept="image/jpeg,image/png,image/webp"
                multiple
                required={needsImages}
                disabled={isPolling}
              />
            )}

            {/* Generate */}
            <Button
              onClick={handleGenerate}
              disabled={isPolling || !canGenerate}
              className="w-full"
              size="lg"
            >
              {isPolling
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</>
                : <><Video className="mr-2 h-4 w-4" />Generate Video</>}
            </Button>
          </div>

          {/* Right: Result */}
          <div className="p-6 flex flex-col gap-4">
            <Label className="text-sm font-medium">Result</Label>

            {state.status === 'idle' && (
              <div className="flex-1 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 text-muted-foreground min-h-64">
                <Video className="h-10 w-10 opacity-20" />
                <p className="text-sm">Your generated video will appear here</p>
                <p className="text-xs opacity-60">Video generation typically takes 30–120 seconds</p>
              </div>
            )}

            {state.status === 'polling' && (
              <div className="flex-1 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 text-muted-foreground min-h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Generating your video…</p>
                  <p className="text-xs mt-1">This usually takes 30–120 seconds</p>
                </div>
              </div>
            )}

            {state.status === 'success' && state.output && (
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden border">
                  <video controls src={state.output} className="w-full" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4" /> Generation complete
                  </div>
                  <div className="flex-1" />
                  <a
                    href={state.output}
                    download="generated-video"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                  <Button variant="outline" size="sm" onClick={() => { reset(); setPrompt(''); }}>
                    New video
                  </Button>
                </div>
              </div>
            )}

            {(state.status === 'failed' || state.status === 'timeout') && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-2 text-destructive text-sm">
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Generation failed</p>
                  <p className="mt-0.5 text-xs">{state.error ?? 'Please try again.'}</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={reset}>Try again</Button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export function VideoToolPage({ manifest }: Props) {
  return (
    <Suspense>
      <VideoToolPageInner manifest={manifest} />
    </Suspense>
  );
}
