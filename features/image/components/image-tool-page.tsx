'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ImageIcon, Sparkles, ChevronDown, ChevronUp, Upload, X,
  Download, Loader2, CheckCircle2, XCircle, Search, Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ToolManifest } from '@/features/tools/registry/types';
import { useGenerationPoll } from '@/lib/hooks/use-generation-poll';
import { IMAGE_MODEL_CONFIGS, ASPECT_RATIO_DIMS, type ImageModelConfig } from '../types';

type Props = { manifest: ToolManifest };
type Mode = 'generate' | 'edit';

// ── Prompt Builder ────────────────────────────────────────────────────────────

const COMPOSITIONS = ['', 'Wide shot', 'Close-up', 'Extreme close-up', 'Portrait', 'Low angle', 'Overhead', 'Panoramic'];
const STYLES = ['', 'Photorealistic', '3D animation', 'Film noir', 'Watercolor', 'Oil painting', 'Sketch', 'Anime', 'Cinematic', '1990s product photography'];

interface BuilderFields {
  subject: string; composition: string; action: string;
  location: string; style: string; instructions: string;
}

function PromptBuilder({ mode, onApply }: { mode: Mode; onApply: (prompt: string) => void }) {
  const [fields, setFields] = useState<BuilderFields>({
    subject: '', composition: '', action: '', location: '', style: '', instructions: '',
  });
  const set = (k: keyof BuilderFields) => (v: string) => setFields(prev => ({ ...prev, [k]: v }));

  const handleApply = () => {
    const parts: string[] = [];
    if (fields.subject) parts.push(fields.subject);
    if (fields.action) parts.push(fields.action);
    if (fields.location) parts.push(`in ${fields.location}`);
    if (fields.composition) parts.push(fields.composition);
    if (fields.style) parts.push(`${fields.style} style`);
    if (mode === 'edit' && fields.instructions) parts.push(fields.instructions);
    if (parts.length) onApply(parts.join(', '));
  };

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">6-element prompt builder</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Subject</Label>
          <Input placeholder="A stoic robot barista…" value={fields.subject} onChange={e => set('subject')(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Action</Label>
          <Input placeholder="Brewing a cup of coffee" value={fields.action} onChange={e => set('action')(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Location</Label>
          <Input placeholder="A futuristic cafe on Mars" value={fields.location} onChange={e => set('location')(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Composition</Label>
          <Select value={fields.composition} onValueChange={set('composition')}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              {COMPOSITIONS.map(c => <SelectItem key={c || '_'} value={c || 'any'}>{c || 'Any'}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Style</Label>
          <Select value={fields.style} onValueChange={set('style')}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              {STYLES.map(s => <SelectItem key={s || '_'} value={s || 'any'}>{s || 'Any'}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {mode === 'edit' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Editing instruction</Label>
            <Input placeholder="Change the sofa to navy blue" value={fields.instructions} onChange={e => set('instructions')(e.target.value)} className="h-8 text-sm" />
          </div>
        )}
      </div>
      <Button size="sm" onClick={handleApply} className="w-full mt-1">
        <Wand2 className="mr-2 h-3 w-3" />Build prompt
      </Button>
    </div>
  );
}

// ── Aspect Ratio Selector ─────────────────────────────────────────────────────

function AspectRatioSelector({ ratios, value, onChange }: {
  ratios: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ratios.map(ratio => {
        const [w, h] = ASPECT_RATIO_DIMS[ratio] ?? [24, 24];
        const isActive = value === ratio;
        return (
          <button
            key={ratio}
            onClick={() => onChange(ratio)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-md border px-2 py-1.5 text-xs transition-colors',
              isActive ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
            )}
          >
            <span
              className={cn('rounded-sm border', isActive ? 'border-primary bg-primary/20' : 'border-muted-foreground/40 bg-muted')}
              style={{ width: w, height: h, display: 'block' }}
            />
            <span>{ratio}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Model Card ────────────────────────────────────────────────────────────────

function ModelCard({ config, selected, onClick }: {
  config: ImageModelConfig; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-lg border p-3 text-left transition-all',
        selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-foreground/30',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-tight">{config.name}</span>
        {config.badge && (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{config.badge}</span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{config.description}</p>
      <p className="mt-1.5 text-xs font-medium text-foreground/60">{config.creditCost} credits</p>
    </button>
  );
}

// ── Image Upload Zone ─────────────────────────────────────────────────────────

function ImageUploadZone({ images, onAdd, onRemove, required }: {
  images: string[]; onAdd: (b64: string) => void; onRemove: (i: number) => void; required?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => { if (e.target?.result) onAdd(e.target.result as string); };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1">
        Reference images {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="flex flex-wrap gap-2">
        {images.map((src, i) => (
          <div key={i} className="relative w-16 h-16 rounded border overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="w-full h-full object-cover" />
            <button onClick={() => onRemove(i)}
              className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5">
              <X className="h-3 w-3 text-white" />
            </button>
          </div>
        ))}
        <button
          onClick={() => ref.current?.click()}
          className="w-16 h-16 rounded border-2 border-dashed flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Upload className="h-4 w-4" />
          <span className="text-[10px]">Upload</span>
        </button>
      </div>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden"
        onChange={e => handleFiles(e.target.files)} />
      <p className="text-xs text-muted-foreground">
        {required ? 'At least 1 image required for this model.' : 'Optional: add reference images to guide generation.'}
      </p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function ImageToolPageInner({ manifest }: Props) {
  const searchParams = useSearchParams();
  const { state, startPoll, reset } = useGenerationPoll();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>('generate');
  const [modelId, setModelId] = useState('nano-banana-2');
  const [prompt, setPrompt] = useState('');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('auto');
  const [quality, setQuality] = useState<'medium' | 'high'>('medium');
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('1K');
  const [googleSearch, setGoogleSearch] = useState(false);
  const [seed, setSeed] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  // Resume poll from agent redirect
  const idFromUrl = searchParams.get('id');
  const taskIdFromUrl = searchParams.get('taskId');
  useEffect(() => {
    if (idFromUrl && taskIdFromUrl && state.status === 'idle') {
      startPoll({ taskId: taskIdFromUrl, generationId: idFromUrl });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idFromUrl, taskIdFromUrl]);

  // When mode changes, pick a sensible default model
  useEffect(() => {
    const compatible = IMAGE_MODEL_CONFIGS.find(m => m.mode === mode || m.mode === 'both');
    if (compatible) {
      setModelId(compatible.id);
      setAspectRatio(compatible.aspectRatios[0] ?? 'auto');
    }
  }, [mode]);

  const modelConfig = IMAGE_MODEL_CONFIGS.find(m => m.id === modelId)!;
  const visibleModels = IMAGE_MODEL_CONFIGS.filter(m => m.mode === mode || m.mode === 'both');

  // Sync aspect ratio when model changes (pick a valid one)
  const handleModelSelect = (id: string) => {
    setModelId(id);
    const cfg = IMAGE_MODEL_CONFIGS.find(m => m.id === id);
    if (cfg && !cfg.aspectRatios.includes(aspectRatio)) {
      setAspectRatio(cfg.aspectRatios[0] ?? 'auto');
    }
  };

  const canGenerate = prompt.trim().length > 0 && (!modelConfig?.requiresImages || imageUrls.length > 0);
  const isPolling = state.status === 'polling';

  const handleGenerate = async () => {
    if (!canGenerate) return;
    reset();

    const body: Record<string, unknown> = {
      prompt,
      modelId,
      aspectRatio,
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      promptTitle: prompt.substring(0, 50),
    };
    if (modelConfig?.hasQuality) body.quality = quality;
    if (modelConfig?.hasResolution) body.resolution = resolution;
    if (modelConfig?.hasGoogleSearch) body.googleSearch = googleSearch;
    if (modelConfig?.hasSeed && seed) body.seed = parseInt(seed);

    const res = await fetch('/api/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Request failed' }));
      alert(data.error ?? 'Request failed');
      return;
    }

    const { taskId, generationId } = await res.json();
    await startPoll({ taskId, generationId, modelId, promptTitle: prompt.substring(0, 50) });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{manifest.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{manifest.description}</p>
        </div>
        {/* Mode toggle */}
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
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] h-full">
          {/* ── Left: Controls ── */}
          <div className="p-6 space-y-6 border-r">
            {/* Prompt */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="prompt">Prompt</Label>
                <button
                  onClick={() => setBuilderOpen(o => !o)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Sparkles className="h-3 w-3" />
                  Prompt builder
                  {builderOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>
              <Textarea
                id="prompt"
                placeholder={mode === 'generate'
                  ? 'A stoic robot barista with glowing blue optics, brewing coffee in a futuristic café on Mars, photorealistic style…'
                  : 'Change the sofa\'s color to deep navy blue. Keep everything else identical.'}
                rows={4}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                disabled={isPolling}
              />
              {builderOpen && (
                <PromptBuilder mode={mode} onApply={p => { setPrompt(p); setBuilderOpen(false); }} />
              )}
            </div>

            {/* Model selection */}
            <div className="space-y-2">
              <Label>Model</Label>
              <div className="grid grid-cols-2 gap-2">
                {visibleModels.map(cfg => (
                  <ModelCard key={cfg.id} config={cfg} selected={modelId === cfg.id}
                    onClick={() => handleModelSelect(cfg.id)} />
                ))}
              </div>
            </div>

            {/* Edit mode image upload */}
            {(mode === 'edit' || modelId === 'nano-banana-2') && (
              <ImageUploadZone
                images={imageUrls}
                onAdd={b64 => setImageUrls(prev => [...prev, b64])}
                onRemove={i => setImageUrls(prev => prev.filter((_, idx) => idx !== i))}
                required={modelConfig?.requiresImages}
              />
            )}

            {/* Aspect ratio */}
            <div className="space-y-2">
              <Label>Aspect ratio</Label>
              <AspectRatioSelector
                ratios={modelConfig?.aspectRatios ?? ['1:1']}
                value={aspectRatio}
                onChange={setAspectRatio}
              />
            </div>

            {/* Model-specific settings */}
            {(modelConfig?.hasQuality || modelConfig?.hasResolution || modelConfig?.hasGoogleSearch || modelConfig?.hasSeed) && (
              <div className="space-y-4 rounded-lg border p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Model settings</p>

                {modelConfig.hasQuality && (
                  <div className="space-y-2">
                    <Label>Quality</Label>
                    <div className="flex gap-2">
                      {(['medium', 'high'] as const).map(q => (
                        <button key={q} onClick={() => setQuality(q)} disabled={isPolling}
                          className={cn(
                            'flex-1 rounded-md border py-2 text-sm capitalize transition-colors',
                            quality === q ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-foreground/40',
                          )}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {modelConfig.hasResolution && (
                  <div className="space-y-2">
                    <Label>Resolution</Label>
                    <div className="flex gap-2">
                      {(['1K', '2K', '4K'] as const).map(r => (
                        <button key={r} onClick={() => setResolution(r)} disabled={isPolling}
                          className={cn(
                            'flex-1 rounded-md border py-2 text-sm transition-colors',
                            resolution === r ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-foreground/40',
                          )}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {modelConfig.hasGoogleSearch && (
                  <div className="flex items-center gap-3">
                    <Switch id="gsearch" checked={googleSearch} onCheckedChange={setGoogleSearch} disabled={isPolling} />
                    <div>
                      <Label htmlFor="gsearch" className="flex items-center gap-1">
                        <Search className="h-3 w-3" /> Google Search grounding
                      </Label>
                      <p className="text-xs text-muted-foreground">Generate based on real-time information</p>
                    </div>
                  </div>
                )}

                {modelConfig.hasSeed && (
                  <div className="space-y-2">
                    <Label htmlFor="seed">Seed (optional)</Label>
                    <Input id="seed" type="number" placeholder="e.g. 42 — same seed = same output"
                      value={seed} onChange={e => setSeed(e.target.value)} disabled={isPolling} />
                  </div>
                )}
              </div>
            )}

            {/* Generate button */}
            <Button onClick={handleGenerate} disabled={isPolling || !canGenerate} className="w-full" size="lg">
              {isPolling
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</>
                : <><ImageIcon className="mr-2 h-4 w-4" />{mode === 'edit' ? 'Edit Image' : 'Generate Image'}</>}
            </Button>
          </div>

          {/* ── Right: Result panel ── */}
          <div className="p-6 flex flex-col gap-4">
            <Label className="text-sm font-medium">Result</Label>

            {state.status === 'idle' && (
              <div className="flex-1 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 text-muted-foreground min-h-64">
                <ImageIcon className="h-10 w-10 opacity-20" />
                <p className="text-sm">Your generated image will appear here</p>
              </div>
            )}

            {state.status === 'polling' && (
              <div className="flex-1 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 text-muted-foreground min-h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Generating your image…</p>
                  <p className="text-xs mt-1">This usually takes 15–60 seconds</p>
                </div>
              </div>
            )}

            {state.status === 'success' && state.output && (
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={state.output} alt="Generated image" className="w-full object-contain max-h-[520px]" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4" /> Generation complete
                  </div>
                  <div className="flex-1" />
                  <a
                    href={state.output}
                    download="generated-image"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                  <Button variant="outline" size="sm" onClick={() => { reset(); setPrompt(''); }}>
                    New image
                  </Button>
                </div>
                {/* Use as reference for editing */}
                {mode === 'generate' && (
                  <button
                    onClick={() => {
                      setImageUrls([state.output!]);
                      setMode('edit');
                    }}
                    className="w-full rounded-lg border border-dashed py-2 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                  >
                    Use this image as reference for editing →
                  </button>
                )}
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

            {/* Prompt tips */}
            {state.status === 'idle' && (
              <div className="rounded-lg bg-muted/30 p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Prompt tips</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• <strong>Subject:</strong> Be specific about who or what is in the image</li>
                  <li>• <strong>Style:</strong> Add "photorealistic", "watercolor", "3D animation"</li>
                  <li>• <strong>Composition:</strong> "wide shot", "close-up", "portrait"</li>
                  <li>• <strong>Editing:</strong> Use direct commands — "Change the tie to green"</li>
                  <li>• Use the <Sparkles className="inline h-3 w-3" /> Prompt builder for guided input</li>
                </ul>
              </div>
            )}
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
