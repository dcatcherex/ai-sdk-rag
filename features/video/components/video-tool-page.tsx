'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Video, Upload, X, Loader2, CheckCircle2, XCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ToolManifest } from '@/features/tools/registry/types';
import { useGenerationPoll } from '@/lib/hooks/use-generation-poll';
import { VEO_GENERATION_MODE_LABELS, VIDEO_MODEL_CONFIGS, type VideoModelConfig } from '../types';
import { ModelSelector } from '@/features/image/components/model-selector';

type Props = { manifest: ToolManifest };

/** Human-readable labels for Sora/Kling aspect ratios */
const ASPECT_RATIO_LABELS: Record<string, string> = {
  landscape: 'Landscape (16:9)',
  portrait: 'Portrait (9:16)',
  '16:9': '16:9 Landscape',
  '9:16': '9:16 Portrait',
  Auto: 'Auto',
};

/** Human-readable labels for quality options */
const QUALITY_LABELS: Record<string, string> = {
  standard: 'Standard',
  high: 'High',
  std: 'Standard',
  pro: 'Pro',
};

function VideoToolPageInner({ manifest }: Props) {
  const searchParams = useSearchParams();
  const { state, startPoll, reset } = useGenerationPoll();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [modelId, setModelId] = useState('veo3_fast');
  const [prompt, setPrompt] = useState('');
  const [veoMode, setVeoMode] = useState('TEXT_2_VIDEO');
  const [aspectRatio, setAspectRatio] = useState('');
  const [duration, setDuration] = useState('');
  const [quality, setQuality] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

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
    setImageUrls([]);
    setImagePreviews([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId]);

  // Derived state
  const isVeo = videoOptions.apiType === 'veo';
  const showVeoModes = isVeo && (videoOptions.veoModes?.length ?? 0) > 1;
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const b64 = ev.target?.result as string;
        setImageUrls(prev => [...prev, b64]);
        setImagePreviews(prev => [...prev, b64]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeImage = (i: number) => {
    setImageUrls(prev => prev.filter((_, idx) => idx !== i));
    setImagePreviews(prev => prev.filter((_, idx) => idx !== i));
  };

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

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 h-full">

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

            {/* Veo generation mode */}
            {showVeoModes && (
              <div className="space-y-2">
                <Label>Generation mode</Label>
                <Select value={veoMode} onValueChange={setVeoMode} disabled={isPolling}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {videoOptions.veoModes!.map(m => (
                      <SelectItem key={m} value={m}>
                        {VEO_GENERATION_MODE_LABELS[m] ?? m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isVeo && veoMode === 'REFERENCE_2_VIDEO' && (
                  <p className="text-xs text-muted-foreground">Reference mode is locked to 16:9 and requires veo3_fast.</p>
                )}
              </div>
            )}

            {/* Aspect ratio */}
            {videoOptions.aspectRatios && !(isVeo && veoMode === 'REFERENCE_2_VIDEO') && (
              <div className="space-y-2">
                <Label>Aspect ratio</Label>
                <Select value={aspectRatio} onValueChange={setAspectRatio} disabled={isPolling}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {videoOptions.aspectRatios.map(r => (
                      <SelectItem key={r} value={r}>{ASPECT_RATIO_LABELS[r] ?? r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Duration */}
            {videoOptions.duration && (
              <div className="space-y-2">
                <Label>Duration</Label>
                <div className="flex gap-2">
                  {videoOptions.duration.map(d => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      disabled={isPolling}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors
                        ${duration === d
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-foreground/30 text-muted-foreground'}`}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quality */}
            {videoOptions.quality && (
              <div className="space-y-2">
                <Label>Quality</Label>
                <div className="flex gap-2">
                  {videoOptions.quality.values.map(q => (
                    <button
                      key={q}
                      onClick={() => setQuality(q)}
                      disabled={isPolling}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors
                        ${quality === q
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-foreground/30 text-muted-foreground'}`}
                    >
                      {QUALITY_LABELS[q] ?? q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Image upload */}
            {showImageUpload && (
              <div className="space-y-3">
                <Label>
                  {imageLabel}
                  {needsImages && <span className="text-destructive ml-1">*</span>}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="relative w-20 h-20 rounded border overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`img-${i}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5"
                        disabled={isPolling}
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ))}
                  <button
                    className="w-20 h-20 rounded border-2 border-dashed flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isPolling}
                  >
                    <Upload className="h-4 w-4" />
                    <span className="text-xs">Upload</span>
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
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
