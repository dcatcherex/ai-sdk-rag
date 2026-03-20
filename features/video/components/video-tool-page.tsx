'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Video, Upload, X, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ToolManifest } from '@/features/tools/registry/types';
import { useGenerationPoll } from '@/lib/hooks/use-generation-poll';
import { VEO_GENERATION_MODE_LABELS } from '../types';

type Props = { manifest: ToolManifest };

const MODELS = [
  { id: 'veo3_fast', label: 'Veo 3 Fast (default)' },
  { id: 'veo3', label: 'Veo 3 (high quality, text-only)' },
];

const ASPECT_RATIOS = ['16:9', '9:16', 'Auto'] as const;

function VideoToolPageInner({ manifest }: Props) {
  const searchParams = useSearchParams();
  const { state, startPoll, reset } = useGenerationPoll();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('veo3_fast');
  const [generationMode, setGenerationMode] = useState('TEXT_2_VIDEO');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | 'Auto'>('16:9');
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

  const needsImages = generationMode !== 'TEXT_2_VIDEO';
  // veo3 only supports text-to-video
  const effectiveModel = model === 'veo3' && generationMode !== 'TEXT_2_VIDEO' ? 'veo3_fast' : model;
  const effectiveAspect = generationMode === 'REFERENCE_2_VIDEO' ? '16:9' : aspectRatio;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach(file => {
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
    if (!prompt.trim()) return;
    if (needsImages && imageUrls.length === 0) return;
    reset();

    const res = await fetch('/api/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        modelId: effectiveModel,
        videoSettings: {
          generationMode,
          aspectRatio: effectiveAspect,
          imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        },
      }),
    });

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Request failed' }));
      alert(error ?? 'Request failed');
      return;
    }

    const { taskId, generationId } = await res.json();
    await startPoll({ taskId, generationId, modelId: effectiveModel, promptTitle: prompt.substring(0, 50) });
  };

  const isPolling = state.status === 'polling';

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">{manifest.title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{manifest.description}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-2xl">
        {/* Prompt */}
        <div className="space-y-2">
          <Label htmlFor="prompt">Prompt</Label>
          <Textarea
            id="prompt"
            placeholder="Describe the video you want to generate…"
            rows={4}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            disabled={isPolling}
          />
        </div>

        {/* Mode */}
        <div className="space-y-2">
          <Label>Generation mode</Label>
          <Select value={generationMode} onValueChange={setGenerationMode} disabled={isPolling}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(VEO_GENERATION_MODE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Model */}
        <div className="space-y-2">
          <Label>Model</Label>
          <Select value={model} onValueChange={setModel} disabled={isPolling}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODELS.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {effectiveModel !== model && (
            <p className="text-xs text-muted-foreground">Using Veo 3 Fast — Veo 3 only supports text-to-video mode.</p>
          )}
        </div>

        {/* Aspect ratio */}
        {generationMode !== 'REFERENCE_2_VIDEO' && (
          <div className="space-y-2">
            <Label>Aspect ratio</Label>
            <Select value={aspectRatio} onValueChange={v => setAspectRatio(v as typeof aspectRatio)} disabled={isPolling}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASPECT_RATIOS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Image upload (frame/reference modes) */}
        {needsImages && (
          <div className="space-y-3">
            <Label>
              {generationMode === 'FIRST_AND_LAST_FRAMES_2_VIDEO'
                ? 'Frame images (first + optional last)'
                : 'Reference images'}
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
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
          </div>
        )}

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={isPolling || !prompt.trim() || (needsImages && imageUrls.length === 0)}
          className="w-full"
        >
          {isPolling
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</>
            : <><Video className="mr-2 h-4 w-4" />Generate Video</>}
        </Button>

        {/* Result */}
        {state.status === 'success' && state.output && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium">
              <CheckCircle2 className="h-4 w-4" /> Generation complete
            </div>
            <video controls src={state.output} className="w-full rounded" />
            <a href={state.output} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
              Open video
            </a>
          </div>
        )}

        {(state.status === 'failed' || state.status === 'timeout') && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-2 text-destructive text-sm">
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {state.error ?? 'Generation failed. Please try again.'}
          </div>
        )}
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
