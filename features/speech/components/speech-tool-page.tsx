'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mic2, Plus, Trash2, Loader2, CheckCircle2, XCircle, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { ToolManifest } from '@/features/tools/registry/types';
import { useGenerationPoll } from '@/lib/hooks/use-generation-poll';
import { ELEVENLABS_VOICES } from '../types';

type Props = { manifest: ToolManifest };

interface DialogueLine { text: string; voice: string }

function SliderField({ label, value, min, max, step, onChange, disabled }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <Label>{label}</Label>
        <span className="text-muted-foreground">{value.toFixed(2)}</span>
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

function SpeechToolPageInner({ manifest }: Props) {
  const searchParams = useSearchParams();
  const { state, startPoll, reset } = useGenerationPoll();

  const [text, setText] = useState('');
  const [voice, setVoice] = useState('BIvP0GN1cAtSRTxNHnWS');
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [styleVal, setStyleVal] = useState(0);
  const [speed, setSpeed] = useState(1);

  const [lines, setLines] = useState<DialogueLine[]>([
    { text: '', voice: 'BIvP0GN1cAtSRTxNHnWS' },
    { text: '', voice: 'TxGEqnHWrfWFTfGW9XjX' },
  ]);
  const [languageCode, setLanguageCode] = useState('en');
  const [dialogueStability, setDialogueStability] = useState(0.5);

  const [activeTab, setActiveTab] = useState('tts');

  const idFromUrl = searchParams.get('id');
  const taskIdFromUrl = searchParams.get('taskId');
  useEffect(() => {
    if (idFromUrl && taskIdFromUrl && state.status === 'idle') {
      startPoll({ taskId: taskIdFromUrl, generationId: idFromUrl });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idFromUrl, taskIdFromUrl]);

  const handleTtsGenerate = async () => {
    if (!text.trim()) return;
    reset();
    const res = await fetch('/api/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: text,
        modelId: 'elevenlabs/text-to-speech-multilingual-v2',
        ttsSettings: { voice, stability, similarityBoost, style: styleVal, speed },
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Request failed' }));
      alert(data.error ?? 'Request failed');
      return;
    }
    const { taskId, generationId } = await res.json();
    await startPoll({ taskId, generationId, promptTitle: text.substring(0, 50) });
  };

  const handleDialogueGenerate = async () => {
    const validLines = lines.filter(l => l.text.trim() && l.voice);
    if (validLines.length === 0) return;
    reset();
    const res = await fetch('/api/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'elevenlabs/text-to-dialogue-v3',
        ttsSettings: { lines: validLines, stability: dialogueStability, languageCode },
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Request failed' }));
      alert(data.error ?? 'Request failed');
      return;
    }
    const { taskId, generationId } = await res.json();
    await startPoll({ taskId, generationId, promptTitle: 'Dialogue' });
  };

  const addLine = () => setLines(prev => [...prev, { text: '', voice: 'BIvP0GN1cAtSRTxNHnWS' }]);
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof DialogueLine, value: string) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  const isPolling = state.status === 'polling';

  const ResultPanel = () => (
    <>
      {state.status === 'success' && state.output && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium">
            <CheckCircle2 className="h-4 w-4" /> Generation complete
          </div>
          <audio controls src={state.output} className="w-full" />
          <a href={state.output} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-primary hover:underline">
            <Play className="h-3 w-3" /> Open audio
          </a>
        </div>
      )}
      {(state.status === 'failed' || state.status === 'timeout') && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-2 text-destructive text-sm">
          <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {state.error ?? 'Generation failed. Please try again.'}
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">{manifest.title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{manifest.description}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="tts">Text to Speech</TabsTrigger>
            <TabsTrigger value="dialogue">Dialogue</TabsTrigger>
          </TabsList>

          <TabsContent value="tts" className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="tts-text">Text</Label>
              <Textarea id="tts-text" rows={5} placeholder="Enter text to convert to speech…"
                value={text} onChange={e => setText(e.target.value)} disabled={isPolling} />
            </div>

            <div className="space-y-2">
              <Label>Voice</Label>
              <Select value={voice} onValueChange={setVoice} disabled={isPolling}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ELEVENLABS_VOICES.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} ({v.gender === 'f' ? 'Female' : 'Male'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <SliderField label="Stability" value={stability} min={0} max={1} step={0.05} onChange={setStability} disabled={isPolling} />
              <SliderField label="Similarity boost" value={similarityBoost} min={0} max={1} step={0.05} onChange={setSimilarityBoost} disabled={isPolling} />
              <SliderField label="Style" value={styleVal} min={0} max={1} step={0.05} onChange={setStyleVal} disabled={isPolling} />
              <SliderField label="Speed" value={speed} min={0.7} max={1.2} step={0.05} onChange={setSpeed} disabled={isPolling} />
            </div>

            <Button onClick={handleTtsGenerate} disabled={isPolling || !text.trim()} className="w-full">
              {isPolling ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</> : <><Mic2 className="mr-2 h-4 w-4" />Generate Speech</>}
            </Button>
            <ResultPanel />
          </TabsContent>

          <TabsContent value="dialogue" className="space-y-5">
            <div className="space-y-3">
              {lines.map((line, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Line {i + 1}</span>
                    {lines.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLine(i)} disabled={isPolling}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <Select value={line.voice} onValueChange={v => updateLine(i, 'voice', v)} disabled={isPolling}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ELEVENLABS_VOICES.map(v => (
                        <SelectItem key={v.id} value={v.id} className="text-xs">
                          {v.name} ({v.gender === 'f' ? 'F' : 'M'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea rows={2} placeholder="Line text…" className="text-sm"
                    value={line.text} onChange={e => updateLine(i, 'text', e.target.value)} disabled={isPolling} />
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addLine} disabled={isPolling}>
                <Plus className="mr-1 h-3 w-3" />Add line
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lang">Language code</Label>
                <Input id="lang" value={languageCode} onChange={e => setLanguageCode(e.target.value)}
                  placeholder="en" disabled={isPolling} />
              </div>
              <SliderField label="Stability" value={dialogueStability} min={0} max={1} step={0.05}
                onChange={setDialogueStability} disabled={isPolling} />
            </div>

            <Button onClick={handleDialogueGenerate} disabled={isPolling || lines.every(l => !l.text.trim())} className="w-full">
              {isPolling ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</> : <><Mic2 className="mr-2 h-4 w-4" />Generate Dialogue</>}
            </Button>
            <ResultPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export function SpeechToolPage({ manifest }: Props) {
  return (
    <Suspense>
      <SpeechToolPageInner manifest={manifest} />
    </Suspense>
  );
}
