'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Music2, Loader2, CheckCircle2, XCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { ToolManifest } from '@/features/tools/registry/types';
import { useGenerationPoll } from '@/lib/hooks/use-generation-poll';
import { MUSIC_MODEL_CONFIGS } from '../types';
import { ModelSelector } from '@/features/image/components/model-selector';
import { TemplateStrip, type TemplateItem } from '@/components/ui/template-strip';

interface MusicTemplate extends TemplateItem {
  prompt: string;
  modelId: string;
  style?: string;
  instrumental?: boolean;
}

const MUSIC_TEMPLATES: MusicTemplate[] = [
  {
    id: 'lofi',
    title: 'Lo-Fi Chill',
    tag: 'Instrumental · Calm',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #312e81 100%)',
    prompt: 'Cozy lo-fi hip hop study beats, warm vinyl crackle, mellow piano, gentle rain ambience',
    modelId: 'suno-v4.5',
    instrumental: true,
    style: 'lo-fi hip hop, chill, mellow',
  },
  {
    id: 'epic',
    title: 'Epic Orchestral',
    tag: 'Instrumental · Powerful',
    gradient: 'linear-gradient(135deg, #dc2626 0%, #1e1b4b 100%)',
    prompt: 'Epic cinematic orchestral score, rising strings, powerful brass, thunderous drums, heroic theme',
    modelId: 'suno-v4.5',
    instrumental: true,
    style: 'orchestral, cinematic, epic',
  },
  {
    id: 'pop',
    title: 'Pop Song',
    tag: 'Vocal · Upbeat',
    gradient: 'linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)',
    prompt: 'Upbeat summer pop song about chasing dreams and living in the moment, catchy chorus, feel-good energy',
    modelId: 'suno-v4.5',
    style: 'pop, upbeat, summer vibes',
  },
  {
    id: 'electronic',
    title: 'Electronic',
    tag: 'Instrumental · Dance',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #7c3aed 100%)',
    prompt: 'Driving electronic dance track with pulsing synth bass, euphoric build-up, festival drop',
    modelId: 'suno-v5',
    instrumental: true,
    style: 'EDM, electronic, dance',
  },
  {
    id: 'jazz',
    title: 'Jazz Vibes',
    tag: 'Instrumental · Smooth',
    gradient: 'linear-gradient(135deg, #d97706 0%, #92400e 100%)',
    prompt: 'Smooth late-night jazz with walking bass, brushed drums, mellow saxophone improvisation',
    modelId: 'suno-v4.5',
    instrumental: true,
    style: 'jazz, smooth, late night',
  },
  {
    id: 'acoustic',
    title: 'Acoustic Folk',
    tag: 'Vocal · Warm',
    gradient: 'linear-gradient(135deg, #84cc16 0%, #713f12 100%)',
    prompt: 'Heartfelt acoustic folk song about coming home, fingerpicked guitar, warm vocals, storytelling lyrics',
    modelId: 'suno-v4.5',
    style: 'folk, acoustic, storytelling',
  },
];

type Props = { manifest: ToolManifest };

function SliderField({ label, value, min, max, step, onChange, disabled }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <Label>{label}</Label>
        <span className="text-muted-foreground tabular-nums">{value.toFixed(2)}</span>
      </div>
      <Slider
        min={min} max={max} step={step}
        value={[value]}
        onValueChange={(vals: number[]) => onChange(vals[0]!)}
        disabled={disabled}
      />
    </div>
  );
}

function AudioToolPageInner({ manifest }: Props) {
  const searchParams = useSearchParams();
  const { state, startPoll, checkNow, reset } = useGenerationPoll();

  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('suno-v4.5');
  const [customMode, setCustomMode] = useState(false);
  const [instrumental, setInstrumental] = useState(false);
  const [style, setStyle] = useState('');
  const [title, setTitle] = useState('');
  const [vocalGender, setVocalGender] = useState('');
  const [negativeTags, setNegativeTags] = useState('');
  const [styleWeight, setStyleWeight] = useState(0.5);
  const [weirdness, setWeirdness] = useState(0.3);

  const idFromUrl = searchParams.get('id');
  const taskIdFromUrl = searchParams.get('taskId');
  useEffect(() => {
    if (idFromUrl && taskIdFromUrl && state.status === 'idle') {
      startPoll({ taskId: taskIdFromUrl, generationId: idFromUrl });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idFromUrl, taskIdFromUrl]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    reset();

    const audioSettings: Record<string, unknown> = {
      customMode, instrumental,
      negativeTags: negativeTags || undefined,
      styleWeight, weirdnessConstraint: weirdness,
    };
    if (customMode) {
      audioSettings.style = style || undefined;
      audioSettings.title = title || undefined;
    }
    if (!instrumental && vocalGender) audioSettings.vocalGender = vocalGender;

    const res = await fetch('/api/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, modelId: model, audioSettings }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Request failed' }));
      alert(data.error ?? 'Request failed');
      return;
    }

    const { taskId, generationId } = await res.json();
    await startPoll({ taskId, generationId, modelId: model, promptTitle: prompt.substring(0, 50) });
  };

  const isPolling = state.status === 'polling' || state.status === 'delayed';

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
            templates={MUSIC_TEMPLATES}
            onSelect={id => {
              const t = MUSIC_TEMPLATES.find(x => x.id === id);
              if (!t) return;
              setPrompt(t.prompt);
              setModel(t.modelId);
              if (t.instrumental !== undefined) setInstrumental(t.instrumental);
              if (t.style) { setCustomMode(true); setStyle(t.style); }
            }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 flex-1">

          {/* Left: Controls */}
          <div className="p-6 space-y-6 border-r">
            {/* Lyrics / Description */}
            <div className="space-y-2">
              <Label htmlFor="prompt">Lyrics / Description</Label>
              <Textarea id="prompt" placeholder="Describe the music or paste lyrics…" rows={4}
                value={prompt} onChange={e => setPrompt(e.target.value)} disabled={isPolling} />
            </div>

            {/* Model */}
            <div className={isPolling ? 'pointer-events-none opacity-60' : ''}>
              <ModelSelector models={MUSIC_MODEL_CONFIGS} selectedId={model} onSelect={setModel} />
            </div>

            {/* Mode toggles */}
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch id="custom" checked={customMode} onCheckedChange={setCustomMode} disabled={isPolling} />
                <Label htmlFor="custom">Custom mode</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="instrumental" checked={instrumental} onCheckedChange={setInstrumental} disabled={isPolling} />
                <Label htmlFor="instrumental">Instrumental</Label>
              </div>
            </div>

            {/* Custom mode fields */}
            {customMode && (
              <div className="space-y-4 rounded-lg border p-4">
                <div className="space-y-2">
                  <Label htmlFor="style">Style</Label>
                  <Input id="style" placeholder="e.g. lo-fi hip hop, dreamy, upbeat"
                    value={style} onChange={e => setStyle(e.target.value)} disabled={isPolling} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" placeholder="Song title"
                    value={title} onChange={e => setTitle(e.target.value)} disabled={isPolling} />
                </div>
              </div>
            )}

            {/* Vocal gender */}
            {!instrumental && (
              <div className="space-y-2">
                <Label>Vocal gender <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Select value={vocalGender || 'any'} onValueChange={v => setVocalGender(v === 'any' ? '' : v)} disabled={isPolling}>
                  <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="f">Female</SelectItem>
                    <SelectItem value="m">Male</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Negative tags */}
            <div className="space-y-2">
              <Label htmlFor="neg">Negative tags <span className="text-muted-foreground font-normal">(avoid)</span></Label>
              <Input id="neg" placeholder="e.g. heavy metal, distortion"
                value={negativeTags} onChange={e => setNegativeTags(e.target.value)} disabled={isPolling} />
            </div>

            {/* Sliders */}
            <div className="space-y-4">
              <SliderField label="Style weight" value={styleWeight} min={0} max={1} step={0.05}
                onChange={setStyleWeight} disabled={isPolling} />
              <SliderField label="Weirdness" value={weirdness} min={0} max={1} step={0.05}
                onChange={setWeirdness} disabled={isPolling} />
            </div>

            <Button onClick={handleGenerate} disabled={isPolling || !prompt.trim()} className="w-full" size="lg">
              {isPolling
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</>
                : <><Music2 className="mr-2 h-4 w-4" />Generate Music</>}
            </Button>
          </div>

          {/* Right: Result */}
          <div className="p-6 flex flex-col gap-4">
            <Label className="text-sm font-medium">Result</Label>

            {state.status === 'idle' && (
              <div className="flex-1 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 text-muted-foreground min-h-64">
                <Music2 className="h-10 w-10 opacity-20" />
                <p className="text-sm">Your generated music will appear here</p>
                <p className="text-xs opacity-60">Suno generates two tracks per request</p>
              </div>
            )}

            {state.status === 'polling' && (
              <div className="flex-1 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 text-muted-foreground min-h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Generating your music…</p>
                  <p className="text-xs mt-1">This usually takes 30–60 seconds</p>
                </div>
              </div>
            )}

            {state.status === 'success' && state.output && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" /> Generation complete
                </div>
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <audio controls src={state.output} className="w-full" />
                  <a
                    href={state.output}
                    download="generated-music"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" /> Download track
                  </a>
                </div>
                <Button variant="outline" size="sm" onClick={() => { reset(); setPrompt(''); }}>
                  Generate new
                </Button>
              </div>
            )}

            {state.status === 'failed' && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-2 text-destructive text-sm">
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Generation failed</p>
                  <p className="mt-0.5 text-xs">{state.error ?? 'Please try again.'}</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={reset}>Try again</Button>
                </div>
              </div>
            )}

            {(state.status === 'timeout' || state.status === 'delayed') && (
              <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-4 flex items-start gap-2 text-amber-700 dark:text-amber-300 text-sm">
                <Loader2 className="h-4 w-4 mt-0.5 shrink-0 animate-spin" />
                <div>
                  <p className="font-medium">Generation is still running</p>
                  <p className="mt-0.5 text-xs">
                    {state.error ?? 'The provider is taking longer than usual. We will keep this job open for you.'}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={checkNow}>Check now</Button>
                    <Button variant="ghost" size="sm" onClick={reset}>Dismiss</Button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export function AudioToolPage({ manifest }: Props) {
  return (
    <Suspense>
      <AudioToolPageInner manifest={manifest} />
    </Suspense>
  );
}
